import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";

const COLORS = ["#e05a00", "#1a6bb5", "#2a8a3e", "#8b2be2", "#c0392b", "#16638a"];
const LENGTH = 5;

function drawCaptcha(canvas: HTMLCanvasElement, code: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;

  // Background
  ctx.fillStyle = "#f5f5f0";
  ctx.fillRect(0, 0, W, H);

  // Background noise dots
  for (let i = 0; i < 60; i++) {
    ctx.beginPath();
    ctx.arc(
      Math.random() * W,
      Math.random() * H,
      Math.random() * 1.5,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
    ctx.fill();
  }

  // Noise lines
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * W, Math.random() * H);
    ctx.lineTo(Math.random() * W, Math.random() * H);
    ctx.strokeStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.1})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Draw each character with random color, rotation, and position jitter
  const charWidth = W / (LENGTH + 1);
  for (let i = 0; i < code.length; i++) {
    ctx.save();

    const x = charWidth * (i + 0.8) + (Math.random() - 0.5) * 4;
    const y = H / 2 + (Math.random() - 0.5) * 8;
    const angle = (Math.random() - 0.5) * 0.5;
    const size = 22 + Math.floor(Math.random() * 6);
    const color = COLORS[i % COLORS.length];
    const isBold = Math.random() > 0.4;

    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.font = `${isBold ? "bold" : "600"} ${size}px 'Courier New', monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Slight shadow for depth
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(code[i], 0, 0);
    ctx.restore();
  }

  // Overlay strikethrough line
  ctx.beginPath();
  ctx.moveTo(8, H / 2 + (Math.random() - 0.5) * 10);
  ctx.lineTo(W - 8, H / 2 + (Math.random() - 0.5) * 10);
  ctx.strokeStyle = "rgba(80,80,80,0.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

interface SimpleCaptchaProps {
  onVerify: (verified: boolean, token?: string, answer?: string) => void;
  reset?: number;
}

export function SimpleCaptcha({ onVerify, reset }: SimpleCaptchaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [code, setCode]     = useState("");
  const [token, setToken]   = useState("");
  const [input, setInput]   = useState("");
  const [touched, setTouched] = useState(false);

  const redraw = useCallback((c: string) => {
    const canvas = canvasRef.current;
    if (canvas && c) drawCaptcha(canvas, c);
  }, []);

  // Redraw whenever the server-provided code changes
  useEffect(() => { redraw(code); }, [code, redraw]);

  const fetchChallenge = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/captcha");
      const data = await res.json() as { code: string; token: string };
      setCode(data.code);
      setToken(data.token);
      setInput("");
      setTouched(false);
      onVerify(false, undefined, undefined);
    } catch {
      // If server is unreachable, keep current challenge
    }
  }, [onVerify]);

  // Fetch on mount
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchChallenge(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Parent-triggered reset
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (reset) fetchChallenge();
  }, [reset, fetchChallenge]);

  const handleChange = (val: string) => {
    setInput(val);
    setTouched(true);
    const matched = val.trim().toLowerCase() === code.toLowerCase();
    onVerify(matched, matched ? token : undefined, matched ? val.trim() : undefined);
  };

  const isWrong = touched && input !== "" && input.trim().toLowerCase() !== code.toLowerCase();

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Type the characters shown below</p>
      <div className="flex items-center gap-3">
        {/* Canvas image */}
        <canvas
          ref={canvasRef}
          width={160}
          height={48}
          className="rounded border border-gray-200 select-none"
          style={{ imageRendering: "crisp-edges" }}
        />

        {/* Refresh */}
        <button
          type="button"
          onClick={fetchChallenge}
          title="New code"
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Input */}
        <input
          type="text"
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          maxLength={LENGTH}
          placeholder="Enter code"
          autoComplete="off"
          className={[
            "flex-1 h-9 px-3 text-sm border rounded-md font-mono tracking-widest",
            "focus:outline-none focus:ring-2 focus:ring-orange-400",
            isWrong ? "border-destructive text-destructive" : "border-input",
          ].join(" ")}
        />
      </div>
      {isWrong && (
        <p className="text-xs text-destructive">Incorrect code. Please try again.</p>
      )}
    </div>
  );
}
