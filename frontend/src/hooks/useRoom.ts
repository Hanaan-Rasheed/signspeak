
"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { API_URL, getToken } from "@/lib/api";
import type { Room, Segment } from "@/types";

type JoinResponse = {
  ok: boolean;
  error?: string;
  room?: Room;
};

export function useRoom(code: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);

  const [count, setCount] = useState(0);
  const [interim, setInterim] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");

  // Track segment IDs so reconnects don't duplicate messages.
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const token = getToken();

    if (!code || !token) {
      setError("Please log in before joining a classroom.");
      return;
    }

    // Connect to the backend using the user's login token.
    const s = io(API_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    setSocket(s);

    // Add a new speech or sign segment only once.
    const addSegment = (segment: Segment) => {
      if (seen.current.has(segment.id)) return;

      seen.current.add(segment.id);

      setSegments((previous) =>
        [...previous, segment].slice(-500)
      );
    };

    // A socket connection alone doesn't mean the room was joined.
    s.on("connect", () => {
      setConnected(true);
      setJoined(false);
      setError("");

      s.timeout(5000).emit(
        "room:join",
        code.toUpperCase(),
        (
          timeoutError: Error | null,
          response?: JoinResponse
        ) => {
          if (timeoutError) {
            setError("Classroom connection timed out. Please retry.");
            setJoined(false);
            return;
          }

          if (!response?.ok) {
            setError(
              response?.error || "Unable to join this classroom."
            );
            setJoined(false);
            return;
          }

          if (response.room) {
            setRoom(response.room);
          }

          setJoined(true);
          setError("");

          console.log("Joined classroom:", code);
        }
      );
    });

    // Show the disconnected state if the server connection drops.
    s.on("disconnect", () => {
      setConnected(false);
      setJoined(false);
    });

    s.on("connect_error", (connectionError: Error) => {
      setConnected(false);
      setJoined(false);
      setError(connectionError.message);
    });

    // Update the number of connected students.
    s.on("room:count", (studentCount: number) => {
      setCount(studentCount);
    });

    // Restore saved messages when joining or reconnecting.
    s.on("room:history", (history: Segment[]) => {
      setSegments(history);

      seen.current = new Set(
        history.map((segment) => segment.id)
      );
    });

    // Receive temporary live captions.
    s.on("caption:interim", (data: { text: string }) => {
      setInterim(data.text);
    });

    // Receive finalized captions from the teacher.
    s.on("caption:final", (segment: Segment) => {
      addSegment(segment);
      setInterim("");
    });

    // Receive detected signs from students.
    s.on("sign:detected", (segment: Segment) => {
      addSegment(segment);

      console.log("Sign received:", segment.text);
    });

    // Update the classroom when the teacher ends the session.
    s.on("room:ended", () => {
      setRoom((previous) =>
        previous
          ? { ...previous, status: "ended" }
          : previous
      );

      setInterim("");
    });

    // Close the socket when leaving this classroom.
    return () => {
      s.disconnect();
      seen.current.clear();
    };
  }, [code]);

  return {
    socket,
    connected,
    joined,
    count,
    interim,
    segments,
    room,
    error,
  };
}
