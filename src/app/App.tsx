import React, { useEffect, useMemo, useRef, useState } from "react";
import type { BookingResponse, Slot } from "../api/calendly";
import {
  getFromQuery,
  getPsyIdFromQuery,
  isoUtcNow,
  isoUtcPlusDays,
} from "../shared/date";

type Step = "slots" | "details" | "success";

const PSY_AUTH: Array<{ id: string; token: string }> = [
  {
    id: "123",
    token:
      "eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ",
  },
  // { id: "124", token: "PASTE_TOKEN_HERE" },
];

function getTokenByPsyId(psyId: string): string | null {
  const foundToken = PSY_AUTH.find((x) => x.id === String(psyId));
  return foundToken?.token ?? null;
}

function getApiBase(): string {
  const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!base) throw new Error("VITE_API_BASE_URL is not set in .env.local");
  return base.replace(/\/$/, "");
}

function goToAgreement() {
  window.open(
    "https://www.raricenter.com/public-offerta-grushko",
    "_blank",
    "noopener"
  );
}

async function apiGet<T>(
  path: string,
  params: Record<string, string>,
  bearerToken: string
): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path}?${new URLSearchParams(params).toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

async function apiPost<T>(
  path: string,
  body: any,
  bearerToken: string
): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

// ----------------------
// MOCK SLOTS (fallback)
// ----------------------
function buildMockSlots(days = 14): Slot[] {
  const now = new Date();
  const res: Slot[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);

    const times = [10, 14, 18];
    for (const h of times) {
      const start = new Date(d);
      start.setHours(h, 0, 0, 0);

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30);

      res.push({
        start_utc: start.toISOString(),
        end_utc: end.toISOString(),
      });
    }
  }

  res.sort((a, b) => a.start_utc.localeCompare(b.start_utc));
  return res;
}

function shouldForceMock(): boolean {
  const v = (getFromQuery("mock") || "").trim();
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

export function App() {
  const psyId = useMemo(() => getPsyIdFromQuery(), []);
  const price = useMemo(() => getFromQuery("price") || "€20", []);

  const bearerToken = useMemo(() => {
    if (!psyId) return null;
    return getTokenByPsyId(psyId);
  }, [psyId]);

  const [step, setStep] = useState<Step>("slots");
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [agree, setAgree] = useState(false);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [booking, setBooking] = useState<BookingResponse | null>(null);

  const didFetchRef = useRef(false);

  useEffect(() => {
    (async () => {
      // StrictMode guard
      if (didFetchRef.current) return;
      didFetchRef.current = true;

      setLoading(true);
      setError(null);

      try {
        if (!psyId) {
          throw new Error("Не знайдено psyId в query.");
        }

        if (shouldForceMock()) {
          setSlots(buildMockSlots(14));
          return;
        }

        if (!bearerToken) {
          throw new Error(
            `Немає токена для psyId=${psyId}. Додай його в масив PSY_AUTH в App.tsx`
          );
        }

        const from_utc = isoUtcNow();
        const to_utc = isoUtcPlusDays(14);

        const resp = await apiGet<{ slots: Slot[] }>(
          "/api/v1/calendly",
          {
            from_utc,
            to_utc,
          },
          bearerToken
        );

        console.log("Fetched slots:", resp.slots);

        const realSlots = resp.slots ?? [];

        if (realSlots.length === 0) {
          setSlots(buildMockSlots(14));
          return;
        }

        setSlots(realSlots);
      } catch (e: any) {
        setError(e?.message ?? "Ошибка загрузки слотов");
        setSlots(buildMockSlots(14));
      } finally {
        setLoading(false);
      }
    })();
  }, [psyId, bearerToken]);

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );

  const canNext = !!selected;
  const canPay =
    !!selected &&
    name.trim().length >= 2 &&
    emailValid &&
    telegram.trim().length >= 2 &&
    agree;

  function close() {
    window.parent?.postMessage({ type: "CLOSE_BOOKING" }, "*");
  }

  async function onSubmit() {
    if (!selected) return;

    if (shouldForceMock()) {
      setSubmitLoading(true);
      setError(null);
      setTimeout(() => {
        setBooking({
          created_at: new Date().toISOString(),
          event_url: "https://example.com/mock-event",
        } as any);
        setStep("success");
        setSubmitLoading(false);
      }, 600);
      return;
    }

    setSubmitLoading(true);
    setError(null);

    try {
      if (!psyId) throw new Error("psyId відсутній в query.");
      if (!bearerToken) {
        throw new Error(`Немає токена для psyId=${psyId}.`);
      }

      const resp = await apiPost<BookingResponse>(
        "/api/v1/calendly",
        {
          invitee: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
          },
          start_utc: shortUtc(selected.start_utc),
          telegram: telegram.trim(),
        },
        bearerToken
      );

      setBooking(resp);
      setStep("success");

      if ((resp as any).payment_url) {
        window.location.href = (resp as any).payment_url;
      }
    } catch (e: any) {
      setError(e?.message ?? "Ошибка создания записи");
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="topbar">
          <h1 className="title">Пробна сесія</h1>
          <button className="closeBtn" onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        <div className="content">
          {error && (
            <div className="notice">
              <b>Помилка:</b> {error}
            </div>
          )}

          <div className="hero">
            <div className="heroRight">
              <p className="p">
                Ви можете пройти одну <b>пробну сесію</b> з нашим психологом до
                того, як придбати пакет супроводу.
              </p>
              <p className="p">
                Щоб дізнатися про найближчі вільні слоти та забронювати —
                оберіть час нижче.
              </p>

              <div className="meta">Пробна сесія триває 30 хвилин</div>
            </div>
          </div>

          <div className="hr" />

          {step === "slots" && (
            <>
              <div className="stepTitle">Найближчі вільні слоти (2 тижні)</div>

              {loading ? (
                <div className="small">
                  <span className="spinner" /> Завантажую слоти…
                </div>
              ) : slots.length === 0 ? (
                <div className="small">
                  На найближчі 2 тижні немає вільних слотів.
                </div>
              ) : (
                <div className="grid">
                  {slots.map((s) => (
                    <button
                      key={s.start_utc}
                      className="slotBtn"
                      aria-pressed={selected?.start_utc === s.start_utc}
                      onClick={() => setSelected(s)}
                      type="button"
                    >
                      <div>
                        <div className="slotTime">
                          {formatLocalTime(s.start_utc)} —{" "}
                          {formatLocalTime(s.end_utc)}
                        </div>
                        <div className="slotMeta">
                          {formatLocalDate(s.start_utc)}
                        </div>
                      </div>
                      {/* <div className="slotMeta">
                        UTC: {shortUtc(s.start_utc)}
                      </div> */}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === "details" && (
            <>
              <div className="stepTitle">Дані для запису</div>
              <div className="small">
                Обраний слот:{" "}
                <b>
                  {selected
                    ? `${formatLocalTime(
                        selected.start_utc
                      )} — ${formatLocalTime(
                        selected.end_utc
                      )} (${formatLocalDate(selected.start_utc)})`
                    : "—"}
                </b>
              </div>
              <div className="hr" />

              <div className="field">
                <label>Імʼя *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Наприклад: Анна"
                />
                {name.trim().length > 0 && name.trim().length < 2 && (
                  <div className="error">Мінімум 2 символи</div>
                )}
              </div>

              <div className="field">
                <label>Email *</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
                {email.trim().length > 0 && !emailValid && (
                  <div className="error">Некоректний email</div>
                )}
              </div>

              <div className="field">
                <label>Telegram (тег або телефон) *</label>
                <input
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="@username або +380..."
                />
                {telegram.trim().length > 0 && telegram.trim().length < 2 && (
                  <div className="error">Заповни поле</div>
                )}
              </div>

              <div className="field">
                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    fontSize: 14,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    id="cb1"
                  />
                  <span>
                    Я погоджуюся з{" "}
                    <span
                      style={{
                        textDecoration: "underline",
                        color: "#0e756f",
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        goToAgreement();
                      }}
                    >
                      <a
                        href="https://www.raricenter.com/public-offerta-grushko"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          textDecoration: "underline",
                          color: "#0e756f",
                          cursor: "pointer",
                        }}
                      ></a>
                      умовами оферти
                    </span>
                  </span>
                </label>
              </div>
            </>
          )}

          {step === "success" && (
            <div className="success">
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                Запис створено ✅
              </div>
              <div className="small">
                Слот:{" "}
                <b>
                  {selected
                    ? `${formatLocalTime(
                        selected.start_utc
                      )} — ${formatLocalTime(
                        selected.end_utc
                      )} (${formatLocalDate(selected.start_utc)})`
                    : "—"}
                </b>
              </div>
              {booking?.event_url && (
                <div className="small">
                  Event URL:{" "}
                  <a href={booking.event_url} target="_blank" rel="noreferrer">
                    {booking.event_url}
                  </a>
                </div>
              )}
              <div className="small" style={{ marginTop: 8 }}>
                Якщо бекенд повертає <code>payment_url</code> — ми одразу
                редіректимо на оплату.
              </div>
            </div>
          )}
        </div>

        <div className="footer">
          <div className="price">
            Ціна: <b>{price}</b>
          </div>

          <div className="actions">
            {step === "details" && (
              <button
                className="btn"
                onClick={() => setStep("slots")}
                disabled={submitLoading}
              >
                Назад
              </button>
            )}

            {step === "slots" && (
              <button
                className="btn btnPrimary"
                onClick={() => setStep("details")}
                disabled={!canNext || loading}
              >
                {loading ? "Завантажую…" : "Далі"}
              </button>
            )}

            {step === "details" && (
              <button
                className="btn btnPrimary"
                onClick={onSubmit}
                disabled={!canPay || submitLoading}
              >
                {submitLoading ? "Створюю…" : "Перейти до оплати"}
              </button>
            )}

            {step === "success" && (
              <button className="btn btnPrimary" onClick={close}>
                Закрити
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function shortUtc(iso: string) {
  return iso.replace(".000Z", "Z");
}

function formatLocalTime(isoUtc: string) {
  const d = new Date(isoUtc);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatLocalDate(isoUtc: string) {
  const d = new Date(isoUtc);
  return d.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}
