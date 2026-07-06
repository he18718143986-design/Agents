import { useState } from "react";
import { friendlyAuthError, login, register } from "../engine/platformClient";

interface PlatformAuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthed: () => void;
}

/** 平台账号登录/注册弹窗（项目云端保存）。 */
export function PlatformAuthModal({ open, onClose, onAuthed }: PlatformAuthModalProps) {
  const [registerMode, setRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    if (!email.trim() || password.length < 8) {
      setError("请填写邮箱，密码至少 8 位");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (registerMode) {
        await register(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      onAuthed();
      onClose();
    } catch (err) {
      setError((registerMode ? "注册失败：" : "登录失败：") + friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stagent-modal-backdrop">
      <div className="stagent-modal" role="dialog" aria-labelledby="platform-auth-title">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 id="platform-auth-title" className="stagent-title text-lg">
              {registerMode ? "注册账号" : "登录账号"}
            </h2>
            <p className="mt-1 text-xs text-stone">
              登录后项目保存在云端，换设备也能继续。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-stone hover:bg-ink-softer hover:text-paper-dim"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-paper-dim">邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              className="stagent-input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-paper-dim">
              密码（至少 8 位）
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              autoComplete={registerMode ? "new-password" : "current-password"}
              className="stagent-input"
            />
          </label>
        </div>

        {error && <p className="stagent-alert stagent-alert--error mt-3">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="stagent-btn stagent-btn--primary mt-4 w-full"
        >
          {busy ? "请稍候…" : registerMode ? "注册并登录" : "登录"}
        </button>

        {registerMode && (
          <p className="mt-2 text-center text-[11px] leading-5 text-stone">
            注册即表示同意
            <a href="/terms" target="_blank" rel="noreferrer" className="text-cinnabar-tint hover:underline">
              《用户协议》
            </a>
            与
            <a href="/privacy" target="_blank" rel="noreferrer" className="text-cinnabar-tint hover:underline">
              《隐私政策》
            </a>
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setRegisterMode((mode) => !mode);
            setError(null);
          }}
          className="mt-3 w-full text-center text-xs text-cinnabar-tint hover:text-paper"
        >
          {registerMode ? "已有账号？直接登录" : "没有账号？注册一个"}
        </button>
      </div>
    </div>
  );
}
