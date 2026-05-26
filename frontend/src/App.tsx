import { useEffect, useState, useRef } from "react";
import type { FormEvent } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL;

// Timeout wrapper: rejects if fetch takes longer than `ms` milliseconds
async function fetchWithTimeout(url: string, options: RequestInit, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface UserInfo {
  userId: string;
  name?: string;
  age: number;
  gender: string;
  profession: string;
}

interface SessionData {
  user?: UserInfo;
  aiText?: string;
  manualText?: string;
}

const STEPS = ["Your Info", "AI Writing", "Manual Writing", "Done"];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="progress-bar-wrapper">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isComplete = step > stepNum;
        const isActive = step === stepNum;
        return (
          <div key={label} className="progress-step">
            <div className={`progress-circle ${isComplete ? "complete" : isActive ? "active" : "pending"}`}>
              {isComplete ? "✓" : stepNum}
            </div>
            <span className={`progress-label ${isActive ? "label-active" : ""}`}>{label}</span>
            {i < STEPS.length - 1 && (
              <div className={`progress-line ${isComplete ? "line-complete" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [session, setSession] = useState<SessionData>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sessionUser");
      if (raw) {
        const user = JSON.parse(raw) as UserInfo;
        setSession({ user });
      }
    } catch (e) {
      console.warn("Failed to parse sessionUser from localStorage", e);
    }
  }, []);

  // Keep the server awake — ping every 5 minutes so it never cold-starts on a user
  useEffect(() => {
    const ping = () => fetch(`${API}/api/ping`).catch(() => {});
    ping(); // ping immediately on page load
    const interval = setInterval(ping, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const advance = () => setStep((s) => ((s + 1) as 1 | 2 | 3 | 4));

  // Returns true on success, false on failure
  const saveUser = async (info: UserInfo): Promise<boolean> => {
    try {
      const res = await fetchWithTimeout(
        `${API}/api/user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(info),
        },
        10000
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || `Server responded ${res.status}`);
      }
      const data = await res.json();
      const savedUser = data?.user || info;
      try {
        localStorage.setItem("sessionUser", JSON.stringify(savedUser));
      } catch (e) {
        console.warn("Failed to persist sessionUser", e);
      }
      setSession((prev) => ({ ...prev, user: savedUser }));
      return true;
    } catch (err: unknown) {
      console.error("❌ User save failed:", err);
      if (!navigator.onLine || (err instanceof Error && (err.name === "AbortError" && !navigator.onLine || err.message.toLowerCase().includes("failed to fetch") || err.message.toLowerCase().includes("network")))) {
        throw new Error("OFFLINE");
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("TIMEOUT");
      }
      throw err;
    }
  };

  const saveAi = async (prompt: string, text: string): Promise<boolean> => {
    const userId = session.user?.userId || (() => {
      try {
        const raw = localStorage.getItem("sessionUser");
        if (!raw) return undefined;
        return JSON.parse(raw).userId as string | undefined;
      } catch { return undefined; }
    })();
    if (!userId) {
      console.error("Missing userId for AI entry");
      return false;
    }
    try {
      const res = await fetchWithTimeout(
        `${API}/api/ai-text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, text, userId }),
        },
        10000
      );
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setSession((prev) => ({ ...prev, aiText: text }));
      return true;
    } catch (err: unknown) {
      console.error("❌ AI text save failed:", err);
      if (!navigator.onLine || (err instanceof Error && (err.message.toLowerCase().includes("failed to fetch") || err.message.toLowerCase().includes("network")))) {
        throw new Error("OFFLINE");
      }
      if (err instanceof Error && err.name === "AbortError") throw new Error("TIMEOUT");
      throw err;
    }
  };

  const saveManual = async (text: string): Promise<boolean> => {
    const userId = session.user?.userId || (() => {
      try {
        const raw = localStorage.getItem("sessionUser");
        if (!raw) return undefined;
        return JSON.parse(raw).userId as string | undefined;
      } catch { return undefined; }
    })();
    if (!userId) {
      console.error("Missing userId for manual entry");
      return false;
    }
    try {
      const res = await fetchWithTimeout(
        `${API}/api/manual-text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, userId }),
        },
        10000
      );
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setSession((prev) => ({ ...prev, manualText: text }));
      return true;
    } catch (err: unknown) {
      console.error("❌ Manual text save failed:", err);
      if (!navigator.onLine || (err instanceof Error && (err.message.toLowerCase().includes("failed to fetch") || err.message.toLowerCase().includes("network")))) {
        throw new Error("OFFLINE");
      }
      if (err instanceof Error && err.name === "AbortError") throw new Error("TIMEOUT");
      throw err;
    }
  };

  return (
    <div className="app-container">
      <div className="app-inner">
        <ProgressBar step={step} />
        {step === 1 && (
          <UserInfoPage
            onNext={async (info) => {
              const ok = await saveUser(info);
              if (!ok) throw new Error("Save failed");
              advance();
            }}
          />
        )}
        {step === 2 && (
          <AiPage
            onNext={async (prompt, text) => {
              const ok = await saveAi(prompt, text);
              if (!ok) throw new Error("Save failed");
              advance();
            }}
          />
        )}
        {step === 3 && (
          <ManualPage
            onSubmit={async (text) => {
              const ok = await saveManual(text);
              if (!ok) throw new Error("Save failed");
              advance();
            }}
          />
        )}
        {step === 4 && <ThankYouPage />}
      </div>
    </div>
  );
}

/*
  Page 1 – user information with required fields.
*/
function UserInfoPage({ onNext }: { onNext: (info: UserInfo) => Promise<void> }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState("");
  const [profession, setProfession] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const newErrors: string[] = [];

    if (!id.trim()) newErrors.push("ID is required");
    if (age === "" || isNaN(Number(age))) newErrors.push("Age is required");
    if (!gender.trim()) newErrors.push("Gender is required");
    if (!profession.trim()) newErrors.push("Profession is required");

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    const info: UserInfo = {
      userId: id.trim(),
      age: Number(age),
      gender: gender.trim(),
      profession: profession.trim(),
    };
    if (name.trim()) info.name = name.trim();

    setSaving(true);
    setApiError(null);
    try {
      await onNext(info);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "OFFLINE") {
        setApiError("No internet connection. Please check your network and try again.");
      } else if (err instanceof Error && err.message === "TIMEOUT") {
        setApiError("The request timed out. Please try again.");
      } else {
        setApiError("Could not save your information. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-container user-form">
      <h2 className="form-title">User Information</h2>

      {errors.length > 0 && (
        <div className="error-box">
          {errors.map((err, i) => (
            <div key={i} className="error-item">- {err}</div>
          ))}
        </div>
      )}

      {apiError && (
        <div className="api-error-box">
          ⚠️ {apiError}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">
          ID (required):
          <input className="form-input" value={id} onChange={(e) => setId(e.target.value)} required />
        </label>
      </div>
      <div className="form-group">
        <label className="form-label">
          Name (optional):
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <div className="form-group">
        <label className="form-label">
          Age (required):
          <input
            className="form-input"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
            required
          />
        </label>
      </div>
      <div className="form-group">
        <label className="form-label">
          Gender (required):
          <select className="form-input" value={gender} onChange={(e) => setGender(e.target.value)} required>
            <option value="" disabled>Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </label>
      </div>
      <div className="form-group">
        <label className="form-label">
          Profession (required):
          <input className="form-input" value={profession} onChange={(e) => setProfession(e.target.value)} required />
        </label>
      </div>

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}

/*
  Page 2 – AI assisted writing. 10-minute timer.
*/
function AiPage({ onNext }: { onNext: (prompt: string, text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [timeLeft, setTimeLeft] = useState(600);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const hasAutoSubmitted = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const timesUp = timeLeft === 0;

  const handleSubmit = async (currentPrompt: string, currentText: string) => {
    setSaving(true);
    setApiError(null);
    try {
      await onNext(currentPrompt, currentText);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "OFFLINE") {
        setApiError("No internet connection. Please check your network and try again.");
      } else if (err instanceof Error && err.message === "TIMEOUT") {
        setApiError("The request timed out. Please try again.");
      } else {
        setApiError("Could not save your response. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Auto-submit when timer expires — use ref to prevent double-firing
  useEffect(() => {
    if (timesUp && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      handleSubmit(prompt, text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timesUp]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!saving) handleSubmit(prompt, text);
  };

  return (
    <form onSubmit={submit} className="form-container writing-form">
      <h2 className="form-title">Write using AI</h2>
      <p className="form-subtext">
        <b>Scenario:</b>&nbsp;You notice many electronic devices in your home (lights, chargers, appliances) are often left on even when not in use. Some people believe small daily habits like turning off unused devices can reduce energy consumption and help the environment over time.
      </p>
      <p className="form-subtext">
        <b>Reflection Question:</b>&nbsp;What are your thoughts on how individual daily habits can influence overall energy consumption and environmental sustainability?
      </p>

      {apiError && (
        <div className="api-error-box">
          ⚠️ {apiError}
          {" "}
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginLeft: "0.5rem", padding: "0.25rem 0.75rem", fontSize: "0.85rem" }}
            onClick={() => handleSubmit(prompt, text)}
            disabled={saving}
          >
            Retry
          </button>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">
          Enter the prompt you gave to AI:
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={saving}
            className="form-textarea"
            placeholder="Enter your AI prompt here..."
          />
        </label>
      </div>
      <textarea
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={saving}
        className="form-textarea"
        placeholder="Start writing..."
      />
      <div className={`timer ${timeLeft < 60 ? "timer-low" : ""}`}>
        Time left: <span className="timer-value">{formatTime(timeLeft)}</span>
      </div>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? "Saving…" : timesUp ? "Time's up! Moving on…" : "Next"}
      </button>
    </form>
  );
}

/*
  Page 3 – manual writing. No copy/paste, 10-minute timer.
*/
function ManualPage({ onSubmit }: { onSubmit: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(600);
  const [timesUp, setTimesUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoSubmitted = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(interval); setTimesUp(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (currentText: string) => {
    setSaving(true);
    setApiError(null);
    try {
      await onSubmit(currentText);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "OFFLINE") {
        setApiError("No internet connection. Please check your network and try again.");
      } else if (err instanceof Error && err.message === "TIMEOUT") {
        setApiError("The request timed out. Please try again.");
      } else {
        setApiError("Could not save your response. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Auto-submit when timer expires — use ref to prevent double-firing
  useEffect(() => {
    if (timesUp && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      handleSubmit(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timesUp]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!saving) handleSubmit(text);
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const handleBeforeInput = (e: InputEvent) => {
      if (e.inputType === "insertFromPaste") e.preventDefault();
    };
    textarea.addEventListener("beforeinput", handleBeforeInput);
    return () => textarea.removeEventListener("beforeinput", handleBeforeInput);
  }, []);

  const block = (e: React.ClipboardEvent) => e.preventDefault();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "v") e.preventDefault();
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const diff = newText.length - text.length;
    if (diff > 1) return;
    if (diff > 0 && text.length > 0) {
      const cursorPos = e.target.selectionStart;
      if (cursorPos && cursorPos < newText.length) return;
    }
    setText(newText);
  };

  return (
    <form onSubmit={submit} className="form-container writing-form">
      <h2 className="form-title">Write without using AI</h2>
      <p className="form-subtext">
        <b>Scenario:</b>&nbsp;When people make everyday choices—such as using public transportation, conserving electricity, or reducing waste—these actions may seem small individually but can have larger collective impacts over time.
      </p>
      <p className="form-subtext">
        <b>Reflection Question:</b>&nbsp;To what extent do you think small individual actions can contribute to solving larger global issues?
      </p>
      <p className="warning-text">⚠️ No AI assistance. Copy/paste is disabled.</p>

      {apiError && (
        <div className="api-error-box">
          ⚠️ {apiError}
          {" "}
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginLeft: "0.5rem", padding: "0.25rem 0.75rem", fontSize: "0.85rem" }}
            onClick={() => handleSubmit(text)}
            disabled={saving}
          >
            Retry
          </button>
        </div>
      )}

      <textarea
        ref={textareaRef}
        rows={10}
        value={text}
        onChange={handleChange}
        disabled={saving}
        className="form-textarea"
        placeholder="Start writing..."
        onCopy={block}
        onPaste={block}
        onCut={block}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={handleKeyDown}
      />
      <div className={`timer ${timeLeft < 60 ? "timer-low" : ""}`}>
        Time left: <span className="timer-value">{formatTime(timeLeft)}</span>
      </div>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? "Saving…" : timesUp ? "Time's up! Saving…" : "Finish"}
      </button>
    </form>
  );
}

/*
  Page 4 – thank you message.
*/
function ThankYouPage() {
  return (
    <div className="thank-you-container">
      <h1 className="thank-you-title">Thank You!</h1>
      <p className="thank-you-message">Your responses have been recorded successfully.</p>
      <p className="thank-you-footer">Thank you for participating in this survey.</p>
    </div>
  );
}

export default App;