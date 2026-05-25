import { useEffect, useState, useRef } from "react";
import type { FormEvent } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL;

// Utility function to format seconds as MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/*
  Types used across the app.
*/
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

function App() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [session, setSession] = useState<SessionData>({});

  // Initialize session from localStorage so `userId` survives refresh/navigation
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

  const advance = () => setStep((s) => ((s + 1) as 1 | 2 | 3 | 4));

  const saveUser = (info: UserInfo) => {
    console.log("[saveUser]", info);
    fetch(`${API}/api/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(info),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("✅ User saved:", data);
        // prefer server-returned user if available
        const savedUser = data?.user || info;
        try {
          localStorage.setItem("sessionUser", JSON.stringify(savedUser));
        } catch (e) {
          console.warn("Failed to persist sessionUser", e);
        }
        setSession((prev) => ({ ...prev, user: savedUser }));
      })
      .catch((err) => console.error("❌ User save failed:", err));
    
    advance();
  };

  const saveAi = (prompt: string, text: string) => {
    console.log("[saveAi]", { prompt, text });
    const userId = session.user?.userId || (() => {
      try {
        const raw = localStorage.getItem("sessionUser");
        if (!raw) return undefined;
        return JSON.parse(raw).userId as string | undefined;
      } catch {
        return undefined;
      }
    })();
    if (!userId) {
      console.error("Missing userId for AI entry");
      return;
    }
    fetch(`${API}/api/ai-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, text, userId }),
    })
      .then((res) => res.json())
      .then((data) => console.log("✅ AI text saved:", data))
      .catch((err) => console.error("❌ AI text save failed:", err));
    setSession((prev) => ({ ...prev, aiText: text }));
    advance();
  };

  const saveManual = (text: string) => {
    console.log("[saveManual]", { text });
    const userId = session.user?.userId || (() => {
      try {
        const raw = localStorage.getItem("sessionUser");
        if (!raw) return undefined;
        return JSON.parse(raw).userId as string | undefined;
      } catch {
        return undefined;
      }
    })();
    if (!userId) {
      console.error("Missing userId for manual entry");
      return;
    }
    fetch(`${API}/api/manual-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, userId }),
    })
      .then((res) => res.json())
      .then((data) => console.log("✅ Manual text saved:", data))
      .catch((err) => console.error("❌ Manual text save failed:", err));
    setSession((prev) => ({ ...prev, manualText: text }));
    advance();
  };

  return (
    <div className="app-container">
      {step === 1 && <UserInfoPage onNext={saveUser} />}
      {step === 2 && <AiPage onNext={(prompt, text) => saveAi(prompt, text)} />}
      {step === 3 && <ManualPage onSubmit={saveManual} />}
      {step === 4 && <ThankYouPage />}
    </div>
  );
}

/*
  Page 1 – user information with required fields.
*/
function UserInfoPage({ onNext }: { onNext: (info: UserInfo) => void }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState("");
  const [profession, setProfession] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: string[] = [];

    if (!id.trim()) {
      newErrors.push("ID is required");
    }
    if (age === "" || isNaN(Number(age))) {
      newErrors.push("Age is required");
    }
    if (!gender.trim()) {
      newErrors.push("Gender is required");
    }
    if (!profession.trim()) {
      newErrors.push("Profession is required");
    }

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
    onNext(info);
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
      <div className="form-group">
        <label className="form-label">
          ID (required):
          <input 
            className="form-input" 
            value={id} 
            onChange={(e) => setId(e.target.value)} 
            required
          />
        </label>
      </div>
      <div className="form-group">
        <label className="form-label">
          Name (optional):
          <input 
            className="form-input" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
          />
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
          <select 
            className="form-input" 
            value={gender} 
            onChange={(e) => setGender(e.target.value)} 
            required
          >
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
          <input
            className="form-input"
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            required
          />
        </label>
      </div>
      <button type="submit" className="btn btn-primary">Continue</button>
    </form>
  );
}

/*
  Page 2 – AI assisted writing about climate change. 10‑minute timer.
*/
function AiPage({ onNext }: { onNext: (prompt: string, text: string) => void }) {
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [timeLeft, setTimeLeft] = useState(600);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const disabled = timeLeft === 0;

  useEffect(() => {
    if (disabled) {
      onNext(prompt, text);
    }
  }, [disabled, prompt, text, onNext]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled) {
      onNext(prompt, text);
    }
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
      <div className="form-group">
        <label className="form-label">
          Enter the prompt you gave to AI:
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={disabled}
            className="form-textarea"
            placeholder="Enter your AI prompt here..."
          />
        </label>
      </div>
      <textarea
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        className="form-textarea"
        placeholder="Start writing..."
      />
      <div className={`timer ${timeLeft < 60 ? "timer-low" : ""}`}>
        Time left: <span className="timer-value">{formatTime(timeLeft)}</span>
      </div>
      <button type="submit" className="btn btn-primary" disabled={disabled}>
        {disabled ? "Time's up! Moving to next page..." : "Next"}
      </button>
    </form>
  );
}

/*
  Page 3 – manual writing about social media without copy/paste and with a 10‑minute lock.
*/
function ManualPage({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(600);
  const [disabled, setDisabled] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastInputMethodRef = useRef<"typing" | "paste" | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setDisabled(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (disabled && timeLeft === 0) {
      onSubmit(text);
    }
  }, [disabled, timeLeft, text, onSubmit]);

  // Monitor beforeinput to detect paste attempts
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleBeforeInput = (e: InputEvent) => {
      if (e.inputType === "insertFromPaste") {
        lastInputMethodRef.current = "paste";
        e.preventDefault();
      } else if (e.inputType === "insertText") {
        lastInputMethodRef.current = "typing";
      }
    };

    textarea.addEventListener("beforeinput", handleBeforeInput);
    return () => textarea.removeEventListener("beforeinput", handleBeforeInput);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled) {
      onSubmit(text);
    }
  };

  const block = (e: React.ClipboardEvent) => e.preventDefault();

  // Block keyboard shortcuts for paste (Ctrl+V, Cmd+V)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      e.preventDefault();
    }
  };

  // Handle text changes and detect paste attempts from clipboard
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const oldText = text;

    // Detect paste: if more than 1 character added at once, reject it
    const diff = newText.length - oldText.length;
    if (diff > 1) {
      // This is likely a paste operation, reject it
      return;
    }

    // Also check if text was inserted in the middle (another paste indicator)
    if (diff > 0 && oldText.length > 0) {
      const cursorPos = e.target.selectionStart;
      if (cursorPos && cursorPos < newText.length) {
        // Text was inserted in the middle, likely a paste
        return;
      }
    }

    setText(newText);
    lastInputMethodRef.current = null;
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
      <textarea
        ref={textareaRef}
        rows={10}
        value={text}
        onChange={handleChange}
        disabled={disabled}
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
      <button type="submit" className="btn btn-primary" disabled={disabled}>
        {disabled ? "Time's up! Submitting..." : "Finish"}
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
      <p className="thank-you-message">
        Your responses have been recorded successfully.
      </p>
      <p className="thank-you-footer">
        Thank you for participating in this survey.
      </p>
    </div>
  );
}

export default App;
