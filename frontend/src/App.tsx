import { useEffect, useState, FormEvent } from "react";
import "./App.css";

/*
  Types used across the app.
*/
interface UserInfo {
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

  const advance = () => setStep((s) => ((s + 1) as 1 | 2 | 3 | 4));

  const saveUser = (info: UserInfo) => {
    console.log("[saveUser]", info);
    fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(info),
    })
      .then((res) => res.json())
      .then((data) => console.log("✅ User saved:", data))
      .catch((err) => console.error("❌ User save failed:", err));
    setSession((prev) => ({ ...prev, user: info }));
    advance();
  };

  const saveAi = (text: string) => {
    console.log("[saveAi]", { text });
    fetch("/api/ai-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((res) => res.json())
      .then((data) => console.log("✅ AI text saved:", data))
      .catch((err) => console.error("❌ AI text save failed:", err));
    setSession((prev) => ({ ...prev, aiText: text }));
    advance();
  };

  const saveManual = (text: string) => {
    console.log("[saveManual]", { text });
    fetch("/api/manual-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
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
      {step === 2 && <AiPage onNext={(text) => saveAi(text)} />}
      {step === 3 && <ManualPage onSubmit={saveManual} />}
      {step === 4 && <ThankYouPage />}
    </div>
  );
}

/*
  Page 1 – user information with required fields.
*/
function UserInfoPage({ onNext }: { onNext: (info: UserInfo) => void }) {
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState("");
  const [profession, setProfession] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: string[] = [];

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
            <option value="">Select Gender</option>
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
function AiPage({ onNext }: { onNext: (text: string) => void }) {
  const [text, setText] = useState("");
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
      onNext(text);
    }
  }, [disabled, text, onNext]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled) {
      onNext(text);
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
      <textarea
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        className="form-textarea"
        placeholder="Start writing..."
      />
      <div className="timer">
        Time left: <span className="timer-value">{timeLeft}</span> seconds
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled) {
      onSubmit(text);
    }
  };

  const block = (e: React.ClipboardEvent) => e.preventDefault();

  return (
    <form onSubmit={submit} className="form-container writing-form">
      <h2 className="form-title">Write without using AI</h2>
      <p className="form-subtext">
        <b>Scenario:</b>&nbsp;When people make everyday choices—such as using public transportation, conserving electricity, or reducing waste—these actions may seem small individually but can have larger collective impacts over time.
      </p>
      <p className="form-subtext">
        <b>Reflection Question:</b>&nbsp;To what extent do you think small individual actions can contribute to solving larger global issues?
      </p><br></br>
      <p className="warning-text">⚠️ No AI assistance. Copy/paste is disabled.</p>
      <textarea
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        className="form-textarea"
        placeholder="Start writing..."
        onCopy={block}
        onPaste={block}
        onCut={block}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="timer">
        Time left: <span className="timer-value">{timeLeft}</span> seconds
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
