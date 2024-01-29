const audio = (volume) => {
  let audioCtx = null;
  let buffer = null;
  let source = null;

  let gainNode = null;
  let interval = null;

  let timeOffset = 0;
  let paused = false;

  let out = new EventTarget();

  return Object.assign(out, {
    async switchTrack(filename, timestamp = 0) {
      if (audioCtx) {
        audioCtx.suspend();
      }

      audioCtx = new AudioContext();

      const response = await fetch(filename);
      buffer = await audioCtx.decodeAudioData(await response.arrayBuffer());

      this.playFromTimestamp(timestamp);

      return buffer.duration;
    },
    playFromTimestamp(timestamp) {
      if (source !== null) {
        source.stop();
      }

      source = audioCtx.createBufferSource();
      source.buffer = buffer;

      gainNode = audioCtx.createGain();
      gainNode.gain.value = volume;
      gainNode.connect(audioCtx.destination);

      source.connect(gainNode);

      timeOffset = audioCtx.currentTime - timestamp * buffer.duration;
      source.start(0, timestamp * buffer.duration);

      source.addEventListener("ended", () => {
        this.dispatchEvent(Object.assign(new Event("ended"), {}));
      });

      this.startInterval();
    },
    unpause() {
      paused = false;
      if (audioCtx) {
        audioCtx.resume();
        this.startInterval();
      }
    },
    pause() {
      paused = true;
      if (audioCtx) {
        this.stopIntervalIfActive();
        audioCtx.suspend();
      }
    },
    setVolume(newVolume) {
      volume = newVolume;
      if (gainNode) {
        gainNode.gain.value = volume;
      }
    },
    getVolume() {
      return volume;
    },
    renderWaveform(canvas) {
      let rect = canvas.getBoundingClientRect();
      if (rect.width != canvas.width || rect.height != canvas.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      let ctx = canvas.getContext("2d");
      let color = getComputedStyle(document.documentElement).getPropertyValue(
        "--accent-color"
      );
      ctx.fillStyle = color;
      ctx.clearRect(0, 0, rect.width, rect.height);

      ctx.beginPath();
      ctx.moveTo(0, rect.height / 2);

      let rawBuffer = buffer.getChannelData(0);

      let getNormalizedPos = (i) =>
        Math.abs(rawBuffer[Math.floor((i * rawBuffer.length) / rect.width)]) *
        (rect.height * 0.5);

      for (let i = 0; i < rect.width; i += 2) {
        ctx.lineTo(
          i,
          rect.height * 0.5 -
            Math.max(getNormalizedPos(i), getNormalizedPos(i + 1))
        );
      }
      for (let i = rect.width - 1; i >= 0; i -= 2) {
        ctx.lineTo(
          i,
          rect.height * 0.5 +
            Math.max(getNormalizedPos(i), getNormalizedPos(i + 1))
        );
      }

      ctx.closePath();
      ctx.fill();
    },
    stopIntervalIfActive() {
      if (interval) {
        window.clearInterval(interval);
      }
    },
    startInterval() {
      this.stopIntervalIfActive();

      let f = () =>
        this.dispatchEvent(
          Object.assign(new Event("timestampChange"), {
            offset: audioCtx.currentTime - timeOffset,
            duration: buffer.duration,
          })
        );

      f();

      if (!paused) {
        window.setInterval(f, 200);
      }
    },
  });
};

export default audio;
