import corsFetch from "./cors";

const audio = (volume) => {
  let audioCtx = null;
  const handler = ()=>{audioCtx=new AudioContext(); document.removeEventListener('pointerup', handler)}
  document.addEventListener('pointerup', handler);
  let buffer = null;
  let source = null;

  let gainNode = null;
  let interval = null;

  let timeOffset = 0;
  let paused = false;
  let silentAudio = document.getElementById('silent-audio');

  let out = new EventTarget();

  return Object.assign(out, {
    async switchTrack(filename, timestamp = 0) {
      if (audioCtx) {
        audioCtx.suspend();
      }

      const response = await corsFetch(filename);
      buffer = await audioCtx.decodeAudioData(await response.arrayBuffer());

      this.playFromTimestamp(timestamp);

      return buffer.duration;
    },
    playFromTimestamp(timestamp) {
      navigator.mediaSession.playbackState = 'playing';
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

      navigator.mediaSession.setPositionState({
        duration: buffer.duration,
        position: timestamp * buffer.duration,
      });

      source.addEventListener("ended", () => {
        if (audioCtx.currentTime - timeOffset >= buffer.duration) {
          this.dispatchEvent(Object.assign(new Event("ended"), {}));
        }
      });

      //silentAudio.play().then(()=>silentAudio.pause())
      this.startInterval();
    },
    getDuration() {
      return self.buffer.duration;
    },
    unpause() {
      console.log("resume", audioCtx.state, audioCtx.currentTime);
      navigator.mediaSession.playbackState = 'playing';
      paused = false;
      if (audioCtx) {
        audioCtx.resume();
        this.startInterval();
        console.log(audioCtx.state, audioCtx.currentTime);
      }
    },
    pause() {
      console.log("pausing...", audioCtx.state, audioCtx.currentTime, silentAudio);
      navigator.mediaSession.playbackState = 'paused';
      paused = true;
      if (audioCtx) {
        this.stopIntervalIfActive();
        audioCtx.suspend();
      }
      //silentAudio.pause();
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
      console.log("rendering waveform");
      
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

      const getPos = (i) =>
        Math.abs(rawBuffer[Math.floor(i)]);

      const maxValue = (i) => {
        let value = 0;
        let start_value = i / rect.width * rawBuffer.length
        for (let j = start_value; j<=(i+1) / rect.width * rawBuffer.length; j++) {
          value = Math.max(value, getPos(j));
        }
        return value;
      }

      let max = 0.01;
      for (let i = 0; i < rect.width; i += 2) {
        max = Math.max(getPos(i), getPos(i + 1), max);
      }

      console.log(`Max = ${max}`);

      for (let i = 0; i < rect.width; i += 2) {
        ctx.lineTo(
          i,
          rect.height * 0.5 -
            maxValue(i) * (rect.height * 0.5) / max
        );
      }
      for (let i = rect.width - 1; i >= 0; i -= 2) {
        ctx.lineTo(
          i,
          rect.height * 0.5 +
            maxValue(i) * (rect.height * 0.5) / max
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
      if (buffer == null) {
        return;
      }

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
