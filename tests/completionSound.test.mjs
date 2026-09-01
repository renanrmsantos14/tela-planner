import test from "node:test";
import assert from "node:assert/strict";

import { playCompletionSound, prepareCompletionSound } from "../src/completionSound.js";

test("prepara e toca o M4A curto de conclusão", async () => {
  const previousAudioContext = globalThis.AudioContext;
  const previousWebkitAudioContext = globalThis.webkitAudioContext;
  const previousFetch = globalThis.fetch;
  const calls = [];

  class FakeAudioContext {
    state = "suspended";
    destination = {};

    resume() {
      calls.push("resume");
      this.state = "running";
      return Promise.resolve();
    }

    decodeAudioData(data) {
      calls.push(["decodeAudioData", data.byteLength]);
      return Promise.resolve({ duration: 1 });
    }

    createBufferSource() {
      calls.push("createBufferSource");
      return {
        connect: () => undefined,
        start: () => calls.push("start"),
        buffer: undefined,
      };
    }

    createGain() {
      calls.push("createGain");
      return { gain: { value: 0 }, connect: () => undefined };
    }
  }

  globalThis.AudioContext = FakeAudioContext;
  globalThis.webkitAudioContext = undefined;
  globalThis.fetch = async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  });

  try {
    prepareCompletionSound();
    playCompletionSound();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(calls.filter((call) => call === "createBufferSource").length, 1);
    assert.equal(calls.filter((call) => call === "start").length, 1);
    assert.ok(calls.some((call) => Array.isArray(call) && call[0] === "decodeAudioData"));
    assert.ok(calls.includes("resume"));
  } finally {
    globalThis.AudioContext = previousAudioContext;
    globalThis.webkitAudioContext = previousWebkitAudioContext;
    globalThis.fetch = previousFetch;
  }
});
