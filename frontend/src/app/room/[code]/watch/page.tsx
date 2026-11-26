
"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Hand,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import Protected from "@/components/Protected";
import CaptionBoard from "@/components/CaptionBoard";
import WebcamPanel from "@/components/sign/WebcamPanel";

import { useRoom } from "@/hooks/useRoom";
import { useAuth } from "@/lib/auth";

// The backend sends this response after receiving a sign.
type SignReply = {
  ok: boolean;
  error?: string;
};

type DeliveryStatus = {
  message: string;
  error: boolean;
} | null;

function StudentClassroom({ code }: { code: string }) {
  const { user } = useAuth();

  const {
    socket,
    connected,
    joined,
    interim,
    segments,
    room,
    error,
  } = useRoom(code);

  const [delivery, setDelivery] =
    useState<DeliveryStatus>(null);

  // Only authenticated students can send detected gestures.
  const canSign = user?.role === "student";

  // Send a recognized gesture and wait for server confirmation.
  const handleSign = useCallback(
    (word: string) => {
      if (!canSign) {
        setDelivery({
          message: "Please sign in with a student account.",
          error: true,
        });
        return;
      }

      if (!socket || !connected || !joined) {
        setDelivery({
          message: "Not connected to the classroom yet.",
          error: true,
        });
        return;
      }

      if (room?.status === "ended") {
        setDelivery({
          message: "This classroom has already ended.",
          error: true,
        });
        return;
      }

      // Send the sign to the backend with a 4-second timeout.
      socket.timeout(4000).emit(
        "sign:detected",
        { word },
        (
          timeoutError: Error | null,
          response?: SignReply
        ) => {
          if (timeoutError) {
            setDelivery({
              message:
                "Server did not respond. Please try again.",
              error: true,
            });
            return;
          }

          if (!response?.ok) {
            setDelivery({
              message:
                response?.error ||
                "The server could not accept this sign.",
              error: true,
            });
            return;
          }

          // The server accepted and broadcast this gesture.
          setDelivery({
            message: `${word} accepted by classroom server`,
            error: false,
          });

          console.log("Sign accepted:", word);
        }
      );
    },
    [socket, connected, joined, room?.status, canSign]
  );

  return (
    <main className="watch-page">
      <div className="wrap">

        {/* Classroom navigation and connection status */}
        <header className="watch-header">
          <Link href="/dashboard" className="back-link">
            <ArrowLeft size={17} />
            Dashboard
          </Link>

          <span className="watch-brand">
            Sign<span>Speak</span> / STUDENT
          </span>

          <span
            className={
              connected && joined
                ? "connection-state"
                : "connection-state offline"
            }
          >
            {connected && joined ? (
              <Wifi size={16} />
            ) : (
              <WifiOff size={16} />
            )}

            {connected && joined
              ? "Connected to class"
              : connected
                ? "Joining room..."
                : "Reconnecting..."}
          </span>
        </header>

        {/* Classroom details */}
        <div className="watch-title">
          <div>
            <span className="overline">
              LIVE CLASSROOM
            </span>

            <h1>
              {room?.title || "Joining your class..."}
            </h1>

            <p>
              Room {code} ·{" "}
              {room?.status === "ended"
                ? "Session ended"
                : "Live caption view"}
            </p>
          </div>
        </div>

        <div className="watch-grid">

          {/* Live captions received from the teacher */}
          <CaptionBoard
            segments={segments}
            interim={interim}
          />

          <div className="watch-aside">

            {/* Optional webcam for student sign input */}
            {canSign ? (
              <>
                {room?.status !== "ended" && (
                  <WebcamPanel onSign={handleSign} />
                )}

                {/* Show whether the backend accepted the sign */}
                {delivery && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={
                      delivery.error
                        ? "form-error"
                        : "watch-note"
                    }
                  >
                    {delivery.error ? (
                      <AlertCircle size={18} />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}

                    <span>{delivery.message}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="side-card">
                <h2>Student sign input</h2>

                <p>
                  You are currently signed in with a
                  teacher account.
                </p>

                <p>
                  To send gestures, open this classroom
                  in a separate browser window and sign
                  in using a student account.
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Display connection and room errors */}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {/* Information about supported gestures */}
        <div className="watch-note">
          <Hand size={19} />

          <span>
            You can read captions without enabling
            your camera. Gesture recognition currently
            supports four demonstration poses.
          </span>
        </div>

      </div>
    </main>
  );
}

// Read the classroom code from the Next.js route.
export default function WatchPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  return (
    <Protected>
      <StudentClassroom code={code.toUpperCase()} />
    </Protected>
  );
}
