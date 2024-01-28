const audio = () => {
  let audioCtx = null;
  let buffer = null;

  let gainNode = null;

  return {
    async switchTrack(filename, timestamp = 0) {
      if (audioCtx) {
        audioCtx.suspend();
      }
      audioCtx = new AudioContext();

      track = null;

      const response = await fetch(filename);
      buffer = await audioCtx.decodeAudioData(await response.arrayBuffer());

      this.playFromTimestamp(timestamp);

      return buffer.duration;
    },
    playFromTimestamp(timestamp) {
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;

      gainNode = audioCtx.createGain();
      gainNode.gain.value = 1.0;
      gainNode.connect(audioCtx.destination);

      source.connect(gainNode);

      source.start(0, timestamp);
    },
    unpause() {
      if (audioCtx) {
        audioCtx.resume();
      }
    },
    pause() {
      if (audioCtx) {
        audioCtx.suspend();
      }
    },
    setVolume(volume) {
      if (audioCtx) {
        gainNode.gain.value = volume;
      }
    },
    renderWaveform(canvas) {
      let rect = canvas.getBoundingClientRect();
      if (rect.width != canvas.width || rect.height != canvas.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      let ctx = canvas.getContext("2d");
      ctx.fillStyle = "red";
      ctx.strokeStyle = "green";

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
  };
};

export default audio();
