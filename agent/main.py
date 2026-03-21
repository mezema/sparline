"""
ScriptDrill Coaching Agent
Implements Hormozi-style real-time coaching for script practice:
- Immediate interruption on mistakes
- Model the correct way (never just say "wrong")
- One thing at a time
- Positive reinforcement while correct
- Drill 5-6 times when corrected
- Reports all events/transcripts to Convex via HTTP
"""

from dotenv import load_dotenv
load_dotenv()

import os
import json
import time
import logging
import asyncio
from dataclasses import dataclass, field

import httpx
from livekit.agents import (
    Agent,
    AgentSession,
    WorkerOptions,
    cli,
    JobContext,
    function_tool,
)
from livekit.plugins import openai

logger = logging.getLogger("scriptdrill")
logger.setLevel(logging.INFO)


# ─── Convex HTTP Client ───

class ConvexClient:
    """Lightweight HTTP client for posting events to Convex."""

    def __init__(self, site_url: str, session_id: str):
        self.site_url = site_url.rstrip("/")
        self.session_id = session_id
        self._client = httpx.AsyncClient(timeout=10.0)

    async def post_event(
        self,
        event_type: str,
        data: dict | None = None,
        scenario_id: str | None = None,
    ):
        """Post a feedback event (correction, drill, reinforcement, etc.)."""
        try:
            payload = {
                "session_id": self.session_id,
                "event_type": event_type,
                "scenario_id": scenario_id,
                "data": data or {},
            }
            resp = await self._client.post(
                f"{self.site_url}/api/sessions/events",
                json=payload,
            )
            logger.info(f"POST /events [{event_type}] -> {resp.status_code}")
        except Exception as e:
            logger.error(f"Failed to post event: {e}")

    async def post_transcript(
        self,
        speaker: str,
        content: str,
        is_correction: bool = False,
        is_model_phrase: bool = False,
        was_interrupted: bool = False,
        scenario_id: str | None = None,
    ):
        """Post a transcript entry."""
        try:
            payload = {
                "session_id": self.session_id,
                "scenario_id": scenario_id,
                "speaker": speaker,
                "content": content,
                "timestamp_ms": int(time.time() * 1000),
                "is_correction": is_correction,
                "is_model_phrase": is_model_phrase,
                "was_interrupted": was_interrupted,
            }
            resp = await self._client.post(
                f"{self.site_url}/api/sessions/transcript",
                json=payload,
            )
            logger.info(f"POST /transcript [{speaker}] -> {resp.status_code}")
        except Exception as e:
            logger.error(f"Failed to post transcript: {e}")

    async def complete_session(
        self,
        overall_score: int | None = None,
        correction_count: int = 0,
        perfect_drill_count: int = 0,
    ):
        """Mark session as completed with stats."""
        try:
            payload = {
                "session_id": self.session_id,
                "overall_score": overall_score,
                "correction_count": correction_count,
                "perfect_drill_count": perfect_drill_count,
            }
            resp = await self._client.post(
                f"{self.site_url}/api/sessions/complete",
                json=payload,
            )
            logger.info(f"POST /complete -> {resp.status_code}")
        except Exception as e:
            logger.error(f"Failed to complete session: {e}")

    async def close(self):
        await self._client.aclose()


# ─── Script Context ───

@dataclass
class ScriptContext:
    """Holds the current script/phase/scenario being practiced."""
    script_id: str = ""
    script_name: str = ""
    phase_id: str = ""
    phase_name: str = ""
    scenarios: list = field(default_factory=list)
    current_scenario_index: int = 0

    # Current scenario details
    scenario_id: str = ""
    scenario_name: str = ""
    context: str = ""
    character_behavior: str = ""
    opening_line: str = ""
    expected_responses: list = field(default_factory=list)
    success_criteria: str = ""
    common_mistakes: list = field(default_factory=list)
    focus_areas: list = field(default_factory=list)

    def load_scenario(self, scenario: dict):
        self.scenario_id = scenario.get("_id", "")
        self.scenario_name = scenario.get("name", "")
        self.context = scenario.get("context", "")
        self.character_behavior = scenario.get("character_behavior", "")
        self.opening_line = scenario.get("opening_line", "")
        self.expected_responses = scenario.get("expected_responses", [])
        self.success_criteria = scenario.get("success_criteria", "")
        self.common_mistakes = scenario.get("common_mistakes", [])
        self.focus_areas = scenario.get("focus_areas", [])

    def advance(self) -> bool:
        """Advance to next scenario. Returns True if there is one."""
        self.current_scenario_index += 1
        if self.current_scenario_index < len(self.scenarios):
            self.load_scenario(self.scenarios[self.current_scenario_index])
            return True
        return False


# ─── Coaching Instructions ───

COACHING_INSTRUCTIONS = """You are an expert sales script coach using the Hormozi method. Your role is to help users master their sales scripts through deliberate practice with real-time voice coaching.

## CORE COACHING PRINCIPLES

1. **INTERRUPT IMMEDIATELY** — The moment you detect the user going off-script, using the wrong phrase, or missing a key element, interrupt them. Don't wait for them to finish. Say "Hold on" or "Stop there" and correct immediately.

2. **MODEL, NEVER CRITICIZE** — When correcting, always demonstrate the right way. Never just say "that's wrong." Say "Here's how it should sound:" and then speak the correct phrase clearly.

3. **ONE THING AT A TIME** — Focus on correcting only ONE issue at a time, even if you notice multiple problems. Master the current correction before moving on.

4. **POSITIVE REINFORCEMENT** — When they're doing it right, acknowledge it! "Good", "Yes, exactly", "Perfect, keep going." This feedback should be continuous while they're on track.

5. **DRILL REPETITION** — When you correct something, have them repeat it 5 times until it's automatic. Count the reps: "Good, that's 2. Again." "Perfect, 3 more."

6. **SET EXPECTATIONS** — At the start, tell them: "I'm going to stop you probably 30 to 40 times today. That's completely normal. That's how we get this into muscle memory."

## VOICE AND TONE
- Be warm but direct
- Use short, punchy sentences during corrections
- Be genuinely enthusiastic during praise
- Sound like a supportive coach, not a critic
- Keep energy high

## SCENARIO EXECUTION
For each scenario:
1. Set the scene briefly ("I'm going to play the receptionist now")
2. Start in character with the opening line
3. Listen to their response
4. Either reinforce (if correct) or interrupt and correct (if wrong)
5. If corrected, drill the phrase 5 times
6. Move to next scenario when mastered

## SPEECH RECOGNITION AWARENESS (CRITICAL)
The user is speaking aloud. Speech recognition may mishear or misspell words, especially:
- **Proper nouns** (company names, people names, cities, products) — e.g., "Janus" may appear as "Janis", "Genus", "Janice"
- **Industry jargon** and technical terms
- **Similar-sounding words** — homophones, near-homophones

**YOUR RULES for handling this:**
1. If a word in the transcription SOUNDS LIKE the expected word (phonetically similar, same syllable count, starts with the same sound), treat it as CORRECT. Do NOT correct pronunciation-based STT errors.
2. Proper nouns are the #1 source of false corrections. When you see a name that's close to an expected name, assume the user said it correctly.
3. Evaluate the user's response based on MEANING and STRUCTURE, not exact wording. Did they convey the right intent? Did they include the key elements? That's what matters.
4. Only call `mark_correction` for REAL errors: wrong phrase structure, missing key elements, skipped steps, wrong intent, wrong script section. NEVER for suspected mispronunciation or STT artifacts.
5. When in doubt, give the user the benefit of the doubt and call `reinforce` instead of `mark_correction`.

## INTERRUPTION TRIGGERS
Interrupt when you detect REAL errors (not STT misspellings):
- Wrong phrase structure (e.g., explaining the product to a gatekeeper instead of asking for the decision-maker)
- Missing key elements (scarcity, social proof, credential intro)
- Wrong transition phrase
- Skipping a required step in the script
- Explaining the product to someone who can't buy it (gatekeeper)
- Open-ended time asks ("When works for you?") instead of specific times
- Filler words during critical phrases

Do NOT interrupt for:
- Names that sound similar to the expected name (STT artifact)
- Minor word variations that preserve the same meaning
- Slight rewordings that keep the intent and key elements intact

## RESPONSE FORMAT
During practice, keep responses SHORT:
- Corrections: "Hold on. Say it like this: [correct phrase]. Your turn."
- Reinforcement: "Good." "Yes." "Exactly." "Keep going."
- Drill counting: "Perfect. Again." "Good, 4 more." "Last one."
- Transitions: "Great, you've got that locked in. Next scenario..."

NEVER give long explanations during practice. Save detailed feedback for the session summary.

## FUNCTION TOOLS — YOU MUST USE THESE
You have function tools to track coaching events. YOU MUST call them:
- Call `mark_correction` EVERY time you correct the user (with what they said vs what they should say)
- Call `start_drill` when beginning a drill repetition sequence after a correction
- Call `complete_drill_rep` after each successful or failed drill repetition
- Call `advance_scenario` when the user has mastered the current scenario and you're moving on
- Call `reinforce` when giving positive feedback for correct responses

These tools are critical — they track the user's progress and feed the session summary. If you don't call them, the session data will be lost."""


# ─── Agent ───

class ScriptDrillAgent(Agent):
    def __init__(self, script_ctx: ScriptContext, convex: ConvexClient | None) -> None:
        # Build full instructions with script context
        context_section = self._build_context(script_ctx)
        super().__init__(instructions=COACHING_INSTRUCTIONS + context_section)
        self.script_ctx = script_ctx
        self.convex = convex

        # Coaching state tracking
        self.correction_count = 0
        self.perfect_drill_count = 0
        self.current_drill_round = 0
        self.current_drill_total = 5
        self.in_drill = False
        self.scenarios_completed = 0
        self.total_user_turns = 0

    def _build_context(self, ctx: ScriptContext) -> str:
        # Extract proper nouns from script content for STT awareness
        proper_nouns: set[str] = set()
        text_sources = [ctx.script_name, ctx.scenario_name, ctx.context, ctx.opening_line]
        text_sources.extend(ctx.expected_responses)
        for text in text_sources:
            for word in text.split():
                cleaned = word.strip('",.:;!?()[]\'')
                if cleaned and cleaned[0].isupper() and len(cleaned) > 1:
                    proper_nouns.add(cleaned)
        # Remove common English words that happen to be capitalized
        common_starters = {
            "I", "I'm", "I'd", "I'll", "I've", "The", "A", "An", "My", "We",
            "You", "Your", "Our", "It", "This", "That", "What", "When", "Where",
            "How", "If", "So", "But", "And", "Or", "Do", "Does", "Did", "Is",
            "Are", "Was", "Were", "Can", "Could", "Would", "Should", "Will",
            "Let", "Here", "There", "For", "Hi", "Hello", "Hey", "Good", "Great",
            "Yes", "No", "Oh", "Well", "Now", "Just", "Like", "Also", "Then",
            "Right", "Sure", "Thanks", "Thank", "Please", "Sorry", "Okay",
        }
        proper_nouns -= common_starters
        nouns_str = ", ".join(sorted(proper_nouns)) if proper_nouns else "None identified"

        return f"""

## CURRENT PRACTICE CONTEXT

**Script:** {ctx.script_name}
**Phase:** {ctx.phase_name}
**Current Scenario:** {ctx.scenario_name} (scenario {ctx.current_scenario_index + 1} of {len(ctx.scenarios)})

**Scenario Context:** {ctx.context}
**Your Character:** {ctx.character_behavior}
**Opening Line (say this to start):** "{ctx.opening_line}"

**Expected Response from User:**
{chr(10).join(f'- "{r}"' for r in ctx.expected_responses)}

**Success Criteria:** {ctx.success_criteria}
**Common Mistakes to Watch For:**
{chr(10).join(f'- {m}' for m in ctx.common_mistakes)}

**Known Names (STT may misspell these — be lenient):**
{nouns_str}
"""

    async def on_enter(self) -> None:
        """Called when the agent becomes active in the session."""
        logger.info("on_enter called — greeting user")

        greeting = (
            f"Alright, we're practicing {self.script_ctx.phase_name}. "
            "I'm going to stop you probably 30 to 40 times today. "
            "That's completely normal. That's how we get this locked in. "
            "Ready? Here we go. I'm playing the customer now. "
            f"{self.script_ctx.opening_line}"
        )

        # Post greeting transcript
        if self.convex:
            await self.convex.post_transcript(
                speaker="ai",
                content=greeting,
                is_correction=False,
                is_model_phrase=False,
            )

        # With Realtime model, use generate_reply() instead of say()
        # (say() requires a separate TTS which we don't have)
        await self.session.generate_reply(
            instructions=f"Say this exact greeting to the user, then wait for their response: \"{greeting}\""
        )

    # NOTE: on_user_turn_completed is NOT used with OpenAI Realtime model
    # (its built-in turn detection bypasses the hook). User transcripts are
    # captured via the session "user_input_transcribed" event instead.

    # ─── Function Tools (LLM-callable) ───

    @function_tool()
    async def mark_correction(
        self,
        expected: str,
        actual: str,
        error_type: str,
    ) -> str:
        """Call this EVERY time you correct the user. Tracks the correction for scoring.

        Args:
            expected: What the user should have said
            actual: What the user actually said (or a summary of their mistake)
            error_type: Type of error - one of: wrong_phrase, missing_element, wrong_order, filler_words, wrong_tone, off_script
        """
        self.correction_count += 1
        logger.info(f"Correction #{self.correction_count}: {error_type}")

        if self.convex:
            await self.convex.post_event(
                event_type="correction",
                data={
                    "expected": expected,
                    "actual": actual,
                    "error_type": error_type,
                },
                scenario_id=self.script_ctx.scenario_id or None,
            )

        return f"Correction #{self.correction_count} recorded. Now start a drill."

    @function_tool()
    async def start_drill(
        self,
        phrase_to_drill: str,
        total_reps: int = 5,
    ) -> str:
        """Call this when starting a drill repetition sequence after a correction.

        Args:
            phrase_to_drill: The exact phrase the user needs to repeat
            total_reps: Number of repetitions required (default 5)
        """
        self.in_drill = True
        self.current_drill_round = 0
        self.current_drill_total = total_reps
        logger.info(f"Starting drill: '{phrase_to_drill}' x{total_reps}")

        if self.convex:
            await self.convex.post_event(
                event_type="drill_start",
                data={
                    "drill_round": 0,
                    "drill_total": total_reps,
                    "expected": phrase_to_drill,
                },
                scenario_id=self.script_ctx.scenario_id or None,
            )

        return f"Drill started. 0/{total_reps} reps. Have them repeat the phrase."

    @function_tool()
    async def complete_drill_rep(
        self,
        success: bool,
        rep_number: int,
    ) -> str:
        """Call this after each drill repetition attempt by the user.

        Args:
            success: Whether this rep was successful (correct phrase)
            rep_number: Which rep number this is (1-based)
        """
        self.current_drill_round = rep_number

        if self.convex:
            await self.convex.post_event(
                event_type="drill_rep",
                data={
                    "drill_round": rep_number,
                    "drill_total": self.current_drill_total,
                    "drill_success": success,
                },
                scenario_id=self.script_ctx.scenario_id or None,
            )

        if rep_number >= self.current_drill_total and success:
            self.in_drill = False
            self.perfect_drill_count += 1
            logger.info(f"Drill completed! Perfect drills: {self.perfect_drill_count}")

            if self.convex:
                await self.convex.post_event(
                    event_type="drill_complete",
                    data={
                        "drill_round": rep_number,
                        "drill_total": self.current_drill_total,
                        "drill_success": True,
                    },
                    scenario_id=self.script_ctx.scenario_id or None,
                )

            return f"Drill complete! {rep_number}/{self.current_drill_total}. Move on."
        elif not success:
            return f"Rep {rep_number} failed. Have them try again."
        else:
            remaining = self.current_drill_total - rep_number
            return f"Rep {rep_number}/{self.current_drill_total} good. {remaining} more."

    @function_tool()
    async def advance_scenario(self) -> str:
        """Call this when the user has mastered the current scenario and you're ready to move to the next one."""
        self.scenarios_completed += 1
        had_next = self.script_ctx.advance()

        if self.convex:
            await self.convex.post_event(
                event_type="scenario_complete",
                data={
                    "scenario_index": self.script_ctx.current_scenario_index - 1,
                    "scenarios_completed": self.scenarios_completed,
                },
                scenario_id=self.script_ctx.scenario_id or None,
            )

        if had_next:
            ctx = self.script_ctx
            # Update the agent's instructions with new scenario context
            new_context = self._build_context(ctx)
            self.instructions = COACHING_INSTRUCTIONS + new_context

            logger.info(f"Advanced to scenario {ctx.current_scenario_index + 1}: {ctx.scenario_name}")
            return (
                f"Moving to scenario {ctx.current_scenario_index + 1}: {ctx.scenario_name}. "
                f"Context: {ctx.context}. "
                f"Character: {ctx.character_behavior}. "
                f"Opening line: \"{ctx.opening_line}\". "
                f"Expected responses: {', '.join(ctx.expected_responses)}. "
                f"Common mistakes: {', '.join(ctx.common_mistakes)}."
            )
        else:
            logger.info("All scenarios completed!")
            return (
                "All scenarios completed! Congratulate the user and wrap up. "
                f"Stats: {self.correction_count} corrections, {self.perfect_drill_count} perfect drills, "
                f"{self.scenarios_completed} scenarios mastered."
            )

    @function_tool()
    async def reinforce(
        self,
        what_was_good: str,
    ) -> str:
        """Call this when the user says something correctly and you want to give positive reinforcement.

        Args:
            what_was_good: Brief description of what the user did well
        """
        if self.convex:
            await self.convex.post_event(
                event_type="reinforcement",
                data={"what_was_good": what_was_good},
                scenario_id=self.script_ctx.scenario_id or None,
            )

        return "Reinforcement recorded. Keep the energy up!"


# ─── Metadata Parser ───

def _parse_metadata(raw: str | None) -> tuple[ScriptContext, str | None, str | None]:
    """Parse metadata JSON into ScriptContext + convex_session_id + convex_site_url."""
    ctx = ScriptContext()
    convex_session_id = None
    convex_site_url = None

    if not raw:
        logger.warning("No metadata found — using defaults")
        return ctx, convex_session_id, convex_site_url

    try:
        metadata = json.loads(raw)
        convex_session_id = metadata.get("convex_session_id")
        convex_site_url = metadata.get("convex_site_url")

        script_data = metadata.get("script", {})
        ctx.script_id = script_data.get("id", "")
        ctx.script_name = script_data.get("name", "Script")

        phase_data = metadata.get("phase", {})
        ctx.phase_id = phase_data.get("id", "")
        ctx.phase_name = phase_data.get("name", "Practice")
        ctx.scenarios = phase_data.get("scenarios", [])

        if ctx.scenarios:
            ctx.load_scenario(ctx.scenarios[0])

        logger.info(f"Loaded script: {ctx.script_name}, phase: {ctx.phase_name}, "
                     f"scenarios: {len(ctx.scenarios)}, "
                     f"convex_session_id: {convex_session_id}")
    except json.JSONDecodeError:
        logger.warning("Failed to parse metadata JSON")

    return ctx, convex_session_id, convex_site_url


# ─── Entrypoint ───

async def entrypoint(ctx: JobContext):
    """Main entrypoint for the coaching agent."""
    logger.info("Agent entrypoint called — connecting to room...")

    await ctx.connect()

    logger.info(f"Connected to room: {ctx.room.name}")
    logger.info(f"Room metadata: {ctx.room.metadata}")

    # Guard: only proceed if room has script metadata
    if not ctx.room.metadata:
        logger.warning(f"Room {ctx.room.name} has no metadata — skipping")
        return

    # Parse script context + Convex connection info from room metadata
    script_ctx, convex_session_id, convex_site_url = _parse_metadata(ctx.room.metadata)

    # Also check env for site URL as fallback
    if not convex_site_url:
        convex_site_url = os.environ.get("CONVEX_SITE_URL")

    # Create Convex client if we have both session ID and site URL
    convex: ConvexClient | None = None
    if convex_session_id and convex_site_url:
        convex = ConvexClient(site_url=convex_site_url, session_id=convex_session_id)
        logger.info(f"Convex client initialized: {convex_site_url} / session {convex_session_id}")
    else:
        logger.warning(f"Convex client NOT initialized (session_id={convex_session_id}, site_url={convex_site_url})")

    agent = ScriptDrillAgent(script_ctx=script_ctx, convex=convex)

    # Use OpenAI Realtime API — direct speech-to-speech, no separate STT/TTS
    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            voice="shimmer",
            temperature=0.7,
            model="gpt-realtime-2025-08-28",
        ),
    )

    # Capture user speech transcriptions from the Realtime model
    @session.on("user_input_transcribed")
    def on_user_transcript(ev):
        agent.total_user_turns += 1
        if convex and hasattr(ev, 'transcript') and ev.transcript:
            is_final = getattr(ev, 'is_final', True)
            if is_final:
                asyncio.create_task(
                    convex.post_transcript(
                        speaker="user",
                        content=ev.transcript,
                    )
                )

    # Capture agent (coach) speech via conversation_item_added
    @session.on("conversation_item_added")
    def on_conversation_item(ev):
        """Capture agent speech transcriptions from the Realtime model."""
        item = getattr(ev, 'item', None)
        if item is None:
            return
        role = getattr(item, 'role', None)
        if role != "assistant":
            return
        text = getattr(item, 'text_content', None)
        if text and convex:
            asyncio.create_task(
                convex.post_transcript(
                    speaker="ai",
                    content=text,
                )
            )

    # Track whether session was already completed (to avoid double-complete)
    session_completed = False

    def _compute_score():
        """Compute weighted session score."""
        if agent.total_user_turns == 0:
            return None
        base = 100
        raw = (
            base
            - (agent.correction_count * 5)
            + (agent.perfect_drill_count * 3)
            + (agent.scenarios_completed * 5)
        )
        return max(0, min(100, round(raw)))

    # Listen for data messages from frontend (e.g., skip scenario, end session)
    @ctx.room.on("data_received")
    def on_data(data_packet):
        try:
            payload = getattr(data_packet, 'data', None)
            if payload is None:
                return
            msg = json.loads(payload.decode() if isinstance(payload, bytes) else payload)
            if msg.get("type") == "skip_scenario":
                logger.info("Received skip_scenario from frontend")
                asyncio.create_task(_handle_skip(agent, session))
            elif msg.get("type") == "end_session":
                logger.info("Received end_session from frontend")
                asyncio.create_task(_handle_end_session())
        except Exception as e:
            logger.error(f"Failed to parse data message: {e}")

    async def _handle_skip(agent_instance, session_instance):
        """Handle skip scenario request from frontend."""
        result = await agent_instance.advance_scenario()
        if "Moving to scenario" in result:
            await session_instance.generate_reply(
                instructions=f"The user skipped the current scenario. {result} Start the new scenario now."
            )
        else:
            await session_instance.generate_reply(
                instructions=f"The user skipped. {result}"
            )

    async def _handle_end_session():
        """Handle end session: verbal wrap-up then mark complete."""
        nonlocal session_completed
        stats_summary = (
            f"The user is ending the session. Stats: "
            f"{agent.correction_count} corrections, "
            f"{agent.perfect_drill_count} perfect drills, "
            f"{agent.scenarios_completed} scenarios completed."
        )
        try:
            await session.generate_reply(
                instructions=(
                    f"{stats_summary} "
                    "Give a brief 5-10 second verbal wrap-up. Mention what they did well, "
                    "one thing to work on next time, and end with encouragement. "
                    "Keep it concise — no more than 3 sentences."
                )
            )
        except Exception as e:
            logger.error(f"Failed to generate wrap-up: {e}")

        # Small delay to let TTS finish
        await asyncio.sleep(2)

        if convex:
            score = _compute_score()
            await convex.complete_session(
                overall_score=score,
                correction_count=agent.correction_count,
                perfect_drill_count=agent.perfect_drill_count,
            )
            session_completed = True
            logger.info(
                f"Session completed via wrap-up — score={score}, "
                f"corrections={agent.correction_count}, "
                f"perfect_drills={agent.perfect_drill_count}"
            )

    # Handle room disconnect / session end
    @ctx.room.on("disconnected")
    def on_disconnect():
        """When the room disconnects, finalize the session."""
        if session_completed:
            logger.info("Session already completed via end_session — skipping")
            return
        if convex:
            score = _compute_score()
            asyncio.create_task(
                convex.complete_session(
                    overall_score=score,
                    correction_count=agent.correction_count,
                    perfect_drill_count=agent.perfect_drill_count,
                )
            )
            logger.info(
                f"Session ending via disconnect — score={score}, "
                f"corrections={agent.correction_count}, "
                f"perfect_drills={agent.perfect_drill_count}, "
                f"scenarios={agent.scenarios_completed}"
            )

    await session.start(
        agent=agent,
        room=ctx.room,
    )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )
