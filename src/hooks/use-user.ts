"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";
import { Id } from "../../convex/_generated/dataModel";

const DEV_EMAIL = "mark@janus.ai";

export function useUser() {
  const user = useQuery(api.users.getByEmail, { email: DEV_EMAIL });
  const getOrCreate = useMutation(api.users.getOrCreate);

  useEffect(() => {
    if (user === null) {
      getOrCreate({ email: DEV_EMAIL, name: "Mark Ezema" });
    }
  }, [user, getOrCreate]);

  return {
    userId: user?._id as Id<"users"> | undefined,
    user,
    isLoading: user === undefined,
  };
}
