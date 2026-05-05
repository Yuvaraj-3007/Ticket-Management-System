import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { RefreshCw } from "lucide-react";

interface SimpleCaptchaProps {
  onVerify: (verified: boolean, token?: string, answer?: string) => void;
  reset?: number;
}

export function SimpleCaptcha({ onVerify, reset }: SimpleCaptchaProps) {
  const [token, setToken]     = useState("");
  const [input, setInput]     = useState("");
  const [touched, setTouched] = useState(false);

  const fetchChallenge = useCallback(async () => {
    try {
      const res  = await fetch("/api/portal/captcha");
      const data = await res.json() as { token: string };
      setToken(data.token);
      setInput("");
      setTouched(false);
      onVerify(false, undefined, undefined);
    } catch {
      // keep current challenge if server unreachable
    }
  }, [onVerify]);

  // Fetch on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { fetchChallenge(); }, []);

  // Parent-triggered reset — only fire when the reset counter actually increments,
  // not when fetchChallenge identity changes due to parent re-renders
  const prevResetRef = useRef(reset ?? 0);
  useLayoutEffect(() => {
    const prev = prevResetRef.current;
    prevResetRef.current = reset ?? 0;
    if ((reset ?? 0) > prev) fetchChallenge();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset]); // fetchChallenge intentionally omitted — only react when reset counter increments

  const handleChange = (val: string) => {
    setInput(val);
    setTouched(true);
    const ready = val.trim().length === 5;
    onVerify(ready, ready ? token : undefined, ready ? val.trim() : undefined);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Type the characters shown below</p>
      {/* Responsive: image+refresh inline, input below on xs — side-by-side from sm up */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        {/* Image + refresh button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <img
            src={token ? `/api/portal/captcha-image?token=${encodeURIComponent(token)}` : undefined}
            alt="CAPTCHA"
            width={160}
            height={48}
            className="rounded border border-gray-200 select-none"
            draggable={false}
          />
          <button
            type="button"
            onClick={fetchChallenge}
            title="New code"
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Input — full width on mobile, flex-1 beside image on sm+ */}
        <input
          type="text"
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          maxLength={5}
          placeholder="Enter code"
          autoComplete="off"
          className={[
            "w-full sm:flex-1 h-9 px-3 text-sm border rounded-md font-mono tracking-widest",
            "focus:outline-none focus:ring-2 focus:ring-orange-400",
            touched && input !== "" && input.trim().length < 5
              ? "border-destructive text-destructive"
              : "border-input",
          ].join(" ")}
        />
      </div>
    </div>
  );
}
