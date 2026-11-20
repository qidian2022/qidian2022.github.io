(() => {
  const gravity = 9.81;
  const amplitude = Math.PI / 18;
  const windowSeconds = 4;
  const maxLength = 1.20;
  const colors = {
    chalk: '#e6f1ec',
    mint: '#9bd8c7',
    orange: '#ffaf7a',
    quiet: '#a1b5b8',
    guide: 'rgba(178,218,211,.24)',
  };

  function line(context, x1, y1, x2, y2, color, dashed = false) {
    context.strokeStyle = color;
    context.setLineDash(dashed ? [3, 4] : []);
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
    context.setLineDash([]);
  }

  function dot(context, x, y, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawApparatus(ctx, width, height, length, theta) {
    const pivotX = width * .49;
    const pivotY = 14;
    const scale = (height - 31) / maxLength;
    const cord = length * scale;
    const extreme = Math.sin(amplitude) * cord;
    const bobX = pivotX + Math.sin(theta) * cord;
    const bobY = pivotY + Math.cos(theta) * cord;
    const rulerX = pivotX - Math.min(45, width * .18);
    ctx.lineWidth = 1;
    line(ctx, pivotX, pivotY, pivotX, height - 4, colors.guide, true);
    line(ctx, pivotX, pivotY, pivotX - extreme, pivotY + cord * Math.cos(amplitude), colors.guide, true);
    line(ctx, pivotX, pivotY, pivotX + extreme, pivotY + cord * Math.cos(amplitude), colors.guide, true);
    line(ctx, rulerX, pivotY, rulerX, pivotY + maxLength * scale, colors.guide);
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.fillStyle = colors.quiet;
    ctx.textAlign = 'right';
    ctx.fillText('L / m', rulerX - 5, pivotY + 2);
    for (let mark = 1; mark <= 4; mark++) {
      const meters = mark * .30;
      const y = pivotY + meters * scale;
      line(ctx, rulerX - 3, y, rulerX + 3, y, colors.quiet);
      ctx.fillText(meters.toFixed(1), rulerX - 7, y + 4);
    }
    ctx.textAlign = 'left';
    line(ctx, rulerX, pivotY + cord, pivotX, pivotY + cord, colors.guide, true);
    dot(ctx, rulerX, pivotY + cord, 2.5, colors.mint);
    line(ctx, pivotX - 26, pivotY - 4, pivotX + 26, pivotY - 4, colors.quiet);
    for (let i = -22; i < 27; i += 7) {
      line(ctx, pivotX + i - 3, pivotY - 8, pivotX + i, pivotY - 4, colors.guide);
    }
    ctx.strokeStyle = colors.mint;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, cord, Math.PI / 2 - amplitude, Math.PI / 2 + amplitude);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    line(ctx, pivotX, pivotY, bobX, bobY, colors.chalk);
    dot(ctx, pivotX, pivotY, 3, colors.mint);
    dot(ctx, bobX, bobY, 7, colors.orange);
    dot(ctx, bobX - 2, bobY - 2, 1.7, '#ffdec0');
  }

  function drawTrace(ctx, width, height, time, omega) {
    const start = Math.floor(time / windowSeconds) * windowSeconds;
    const phase = (time - start) / windowSeconds;
    const left = 5;
    const right = width - 6;
    const mid = height * .5;
    const scale = mid - 4;
    const yAt = fraction => mid - scale * Math.cos((start + fraction * windowSeconds) * omega);
    ctx.lineWidth = 1;
    line(ctx, left, mid, right, mid, colors.guide, true);
    for (let i = 0; i <= windowSeconds; i++) {
      const x = left + (right - left) * i / windowSeconds;
      line(ctx, x, mid - 2, x, mid + 2, colors.quiet);
    }
    ctx.beginPath();
    for (let x = left; x <= right; x++) {
      const y = yAt((x - left) / (right - left));
      if (x === left) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = colors.mint;
    ctx.stroke();
    dot(ctx, left + phase * (right - left), yAt(phase), 3.4, colors.orange);
  }

  class PendulumBench extends HTMLElement {
    connectedCallback() {
      if (!this.querySelector('.pb-box')) {
        this.innerHTML = `
          <div class="pb-box" role="group" aria-label="单摆计时互动实验">
            <div class="pb-heading"><strong>单摆计时</strong><span>初始摆角 10°</span></div>
            <div class="pb-display">
              <canvas class="pb-apparatus" role="img" aria-label="单摆图示，L 表示从悬点到摆球中心的距离"></canvas>
              <div class="pb-meter">
                <span>小角度近似周期</span>
                <div class="pb-value"><output class="pb-period"></output><span> s</span></div>
                <canvas class="pb-trace" role="img" aria-label="四秒内的摆角变化，亮点标出当前摆角"></canvas>
                <span class="pb-caption">摆角 · 4 秒</span>
              </div>
            </div>
            <div class="pb-controls">
              <label class="pb-setting">
                <span class="pb-length-label">摆长 <output class="pb-length"></output></span>
                <input type="range" min="0.30" max="${maxLength.toFixed(2)}" step="0.05" value="0.30" aria-label="摆长">
              </label>
              <button type="button" class="pb-toggle"><i aria-hidden="true"></i><span></span></button>
            </div>
          </div>`;
      }
      this.events = new AbortController();
      const options = { signal: this.events.signal };
      this.slider = this.querySelector('input');
      this.toggle = this.querySelector('.pb-toggle');
      this.apparatus = this.querySelector('.pb-apparatus');
      this.trace = this.querySelector('.pb-trace');
      this.time = 0;
      this.frame = 0;
      this.inView = !('IntersectionObserver' in window);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.playing = !reducedMotion.matches;
      reducedMotion.addEventListener('change', event => {
        if (event.matches) this.setPlaying(false);
      }, options);
      this.toggle.addEventListener('click', () => this.setPlaying(!this.playing), options);
      this.slider.addEventListener('input', () => this.readLength(), options);
      document.addEventListener('visibilitychange', () => this.schedule(), options);
      this.sizeObserver = new ResizeObserver(() => this.draw());
      this.sizeObserver.observe(this.apparatus);
      this.sizeObserver.observe(this.trace);
      if ('IntersectionObserver' in window) {
        this.visibilityObserver = new IntersectionObserver(([entry]) => {
          this.inView = entry.isIntersecting;
          this.schedule();
        });
        this.visibilityObserver.observe(this);
      }
      this.readLength();
      this.setPlaying(this.playing);
    }

    disconnectedCallback() {
      this.events.abort();
      this.sizeObserver.disconnect();
      this.visibilityObserver?.disconnect();
      cancelAnimationFrame(this.frame);
    }

    readLength() {
      this.lengthMeters = Number(this.slider.value);
      this.omega = Math.sqrt(gravity / this.lengthMeters);
      this.time = 0;
      this.last = undefined;
      this.querySelector('.pb-length').value = this.lengthMeters.toFixed(2) + ' m';
      this.querySelector('.pb-period').value = (2 * Math.PI / this.omega).toFixed(2);
      this.slider.setAttribute('aria-valuetext', this.lengthMeters.toFixed(2) + ' 米');
      const fraction = (this.lengthMeters - Number(this.slider.min)) / (Number(this.slider.max) - Number(this.slider.min));
      this.slider.style.setProperty('--pb-filled', (fraction * 100) + '%');
      this.draw();
    }

    setPlaying(playing) {
      this.playing = playing;
      this.toggle.dataset.playing = String(playing);
      this.toggle.querySelector('span').textContent = playing ? '暂停' : '播放';
      this.toggle.setAttribute('aria-label', playing ? '暂停单摆' : '播放单摆');
      this.schedule();
    }

    schedule() {
      cancelAnimationFrame(this.frame);
      this.last = undefined;
      if (this.playing && this.inView && !document.hidden) {
        this.frame = requestAnimationFrame(this.tick);
      }
    }

    tick = now => {
      if (this.last !== undefined) this.time += (now - this.last) / 1000;
      this.last = now;
      this.draw();
      this.frame = requestAnimationFrame(this.tick);
    };

    draw() {
      for (const canvas of [this.apparatus, this.trace]) {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (!width || !height) continue;
        const ratio = Math.min(window.devicePixelRatio || 1, 3);
        const pixelWidth = Math.round(width * ratio);
        const pixelHeight = Math.round(height * ratio);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
        }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
        ctx.clearRect(0, 0, width, height);
        if (canvas === this.apparatus) {
          drawApparatus(ctx, width, height, this.lengthMeters, amplitude * Math.cos(this.omega * this.time));
        } else {
          drawTrace(ctx, width, height, this.time, this.omega);
        }
      }
    }
  }

  if (!customElements.get('pendulum-bench')) customElements.define('pendulum-bench', PendulumBench);
})();
