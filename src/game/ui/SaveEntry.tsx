import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SessionContent } from "../application/SessionContent.ts";
import type { WorldGeneration } from "../terrain/SparseWorld.ts";
import {
  openSavedGame,
  saveNamespace,
  type SavedGame,
} from "../persistence/SaveBootstrap.ts";
import { UiButton } from "./kit/controls.tsx";
import "./save.css";
export function SaveEntry({
  content,
  generation,
  children,
}: {
  content: SessionContent;
  generation: WorldGeneration;
  children: (game: SavedGame) => ReactNode;
}) {
  const [game, setGame] = useState<SavedGame | null>(null);
  const [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState("正在读取存档");
  const [attempt, setAttempt] = useState(0);
  // StrictMode cleanup/retry waits for the previous bootstrap to release ownership.
  const cleanup = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    const abort = new AbortController();
    setError(null);
    setGame(null);
    const task = cleanup.current.then(async () => {
      abort.signal.throwIfAborted();
      const target = saveNamespace(location,generation.worlds?'journey-v1':undefined);
      return openSavedGame(
        target.name,
        content,
        { ...generation, samples: target.samples },
        abort.signal,
        (text) => {
          if (!abort.signal.aborted) setMessage(text);
        },
      );
    });
    void task
      .then((value) => {
        if (!abort.signal.aborted) setGame(value);
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(String(reason));
      });
    return () => {
      abort.abort();
      cleanup.current = task.then((value) => value.close()).catch(() => {});
    };
  }, [content, generation, attempt]);
  useEffect(() => {
    if (!game) return;
    const hidden = () => {
      if (document.visibilityState === "hidden" && !game.session.suspended)
        void game.saves.flush().catch(() => {});
    };
    const leaving = () => {
      game.session.setSuspended(true);
      void game.saves
        .flush()
        .catch(() => {})
        .then(() => game.close());
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) location.reload();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", leaving);
    window.addEventListener("pageshow", restored);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", leaving);
      window.removeEventListener("pageshow", restored);
    };
  }, [game]);
  if (game) return children(game);
  return (
    <main className="game-shell" onContextMenu={(e) => e.preventDefault()}>
      <section className="save-boot" role={error ? "alert" : "status"}>
        <span className="save-boot-mark ui-outline">MINING</span>
        <h2 className="ui-outline">{error ? "暂时无法读取进度" : message}</h2>
        {error && <p className="save-boot-error">{error}</p>}
        <div className="save-boot-actions">
          {error && <UiButton size="m" tone="orange" onPress={() => setAttempt((n) => n + 1)}>重试</UiButton>}
          <UiButton size="m" tone="steel" onPress={() => location.replace(new URL("../../", location.href).href)}>返回游戏列表</UiButton>
        </div>
      </section>
    </main>
  );
}
