const AUDIO_SOURCE = "/sounds/task-completed.m4a";

let audioContext;
let audioBufferPromise;

function getAudioContextConstructor() {
  return globalThis.AudioContext || globalThis.webkitAudioContext;
}

function loadCompletionAudio() {
  if (audioBufferPromise) return audioBufferPromise;

  audioBufferPromise = fetch(AUDIO_SOURCE)
    .then((response) => {
      if (!response.ok) throw new Error("Áudio de conclusão indisponível");
      return response.arrayBuffer();
    })
    .then((audioData) => audioContext.decodeAudioData(audioData))
    .catch(() => {
      audioBufferPromise = undefined;
      return undefined;
    });

  return audioBufferPromise;
}

export function prepareCompletionSound() {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) return;

  try {
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContextConstructor();
      audioBufferPromise = undefined;
    }
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => undefined);
    }
    void loadCompletionAudio();
  } catch {
    audioContext = undefined;
    audioBufferPromise = undefined;
  }
}

export function playCompletionSound() {
  if (!audioContext || audioContext.state === "closed") return;

  void loadCompletionAudio().then((audioBuffer) => {
    if (!audioBuffer || !audioContext || audioContext.state === "closed") return;

    try {
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      gain.gain.value = 1.5;
      source.buffer = audioBuffer;
      source.connect(gain);
      gain.connect(audioContext.destination);
      source.start();
    } catch {
      audioContext = undefined;
      audioBufferPromise = undefined;
    }
  });
}
