/* eslint-disable */
/**
 * DSH Boot FX — full-screen boot splash for the DeepSeek Harness Web GUI.
 *
 * The browser half of `@local/dsh-boot-fx`. It paints a self-contained Shadow
 * DOM overlay when the client plugin is applied: a starfield + aurora stage, the
 * DeepSeek whale mark drawing itself with a light echo, a staggered wordmark,
 * a boot log and a progress line. The overlay holds while the real DSH boot
 * screen finishes loading plugins, then fades into the application.
 *
 * Design constraints (see references/ui-plugin.md):
 *  - no React dependency and no slot registration: this is a boot-time overlay;
 *  - every timer, observer and listener is created inside `apply` and returned
 *    through `ctx.effect` so the host can tear it down;
 *  - the overlay lives in a Shadow DOM attached to one host element appended to
 *    <body>; it never touches the application root;
 *  - no inline `style=` attributes (CSP-safe). The stylesheet is attached as a
 *    constructed sheet when available, falling back to a <style> element.
 */

window.__ModuleLoader__.load({
  id: 'dsh-plugin-boot-fx',
  factory(require) {
    'use strict';

    /* --------------------------------------------------------------------- */
    /* constants                                                             */
    /* --------------------------------------------------------------------- */

    const PACKAGE_ID = 'dsh-plugin-boot-fx';
    const VERSION = '1.3.2';
    const OVERLAY_ATTR = 'data-dsh-boot-fx';
    const SESSION_KEY = 'dsh.bootFx.liveShown';
    const STORAGE_KEY = 'dsh.bootFx.enabled';
    const FRESH_WINDOW_MS = 20000; // applied later than this = live HMR add, not a boot
    /** Global pacing multiplier: 1 = the original v1.2 speed, 1.3 = slower (default). */
    const SPEED = readSpeed();
    const MIN_SHOW_MS = Math.round(3100 * SPEED); // intro + water finale settle, then hold a beat
    const MAX_SHOW_MS = Math.round(10000 * SPEED); // hard ceiling if the app never signals ready
    const LIVE_SHOW_MS = Math.round(2450 * SPEED); // one-off welcome when the plugin is hot-added
    const EXIT_FADE_MS = 480; // base value: CSS times are scaled wholesale below
    const EXIT_MS = Math.round(EXIT_FADE_MS * SPEED);
    const WHALE_PATH = 'M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z';
    const IS_ZH = /^zh/i.test((() => {
      try {
        return navigator.language || '';
      } catch (error) {
        return '';
      }
    })());

    /* --------------------------------------------------------------------- */
    /* tiny helpers                                                          */
    /* --------------------------------------------------------------------- */

    function el(tag, cls, text) {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function s(tag, attrs) {
      const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const key in attrs) node.setAttribute(key, attrs[key]);
      return node;
    }

    function mulberry32(seed) {
      let a = seed >>> 0;
      return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function prefersReducedMotion() {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (error) {
        return false;
      }
    }

    /**
     * Pacing multiplier: `localStorage['dsh.bootFx.speed']` overrides the default
     * 1.3x slowdown without rebuilding the plugin (values below 1 speed it up).
     */
    function readSpeed() {
      try {
        const raw = window.localStorage.getItem('dsh.bootFx.speed');
        if (raw !== null) {
          const value = Number(raw);
          if (Number.isFinite(value) && value >= 0.6 && value <= 2.5) return value;
        }
      } catch (error) {
        /* storage blocked: use the default */
      }
      return 1.3;
    }

    /** Scale every millisecond literal in a stylesheet so all animations share one pace. */
    function scaleCssTimes(css, factor) {
      if (factor === 1) return css;
      return css.replace(/(\d+(?:\.\d+)?)ms/g, function (match, value) {
        return Math.round(Number(value) * factor) + 'ms';
      });
    }

    function storageGet(store, key) {
      try {
        return window[store].getItem(key);
      } catch (error) {
        return null;
      }
    }

    function storageSet(store, key, value) {
      try {
        window[store].setItem(key, value);
      } catch (error) {
        /* private mode / file:// — the splash simply always runs */
      }
    }

    function storageRemove(store, key) {
      try {
        window[store].removeItem(key);
      } catch (error) {
        /* ignore */
      }
    }

    function enabled() {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('bootfx') === 'off') return false;
      } catch (error) {
        /* ignore */
      }
      return storageGet('localStorage', STORAGE_KEY) !== 'off';
    }

    /* --------------------------------------------------------------------- */
    /* copy                                                                  */
    /* --------------------------------------------------------------------- */

    const COPY = {
      zh: {
        sub: '深度求索 · 智能体工作台',
        phrase: '探索未至之境',
        status: ['正在唤醒内核', '正在加载插件', '就绪'],
        hint: '点击任意处跳过',
        corner: 'HARNESS · BOOT SEQUENCE',
        logs: [
          ['kernel', '推理内核自检 · 通过'],
          ['slots', '插件槽位图 · 挂载完成'],
          ['agent', '智能体循环 · 苏醒'],
          ['harness', '开机序列 · 完成']
        ]
      },
      en: {
        sub: 'DEEPSEEK · AGENT WORKBENCH',
        phrase: '探索未至之境',
        status: ['WAKING CORE', 'LOADING PLUGINS', 'READY'],
        hint: 'click to skip',
        corner: 'HARNESS · BOOT SEQUENCE',
        logs: [
          ['kernel', 'inference core · self-test passed'],
          ['slots', 'plugin graph · mounted'],
          ['agent', 'agent loop · awake'],
          ['harness', 'boot sequence · complete']
        ]
      }
    };

    /* --------------------------------------------------------------------- */
    /* styles                                                               */
    /* --------------------------------------------------------------------- */

    function starRules(selector, count, seed, minSize, maxSize, minOpacity, maxOpacity, maxDuration) {
      const random = mulberry32(seed);
      let rules = '';
      for (let index = 1; index <= count; index += 1) {
        const x = (random() * 100).toFixed(2);
        const y = (random() * 100).toFixed(2);
        const size = (minSize + random() * (maxSize - minSize)).toFixed(2);
        const opacity = (minOpacity + random() * (maxOpacity - minOpacity)).toFixed(2);
        const delay = Math.round(random() * 4200);
        const duration = Math.round(2600 + random() * maxDuration);
        rules +=
          '.' + selector + ' span:nth-child(' + index + '){left:' + x + '%;top:' + y + '%;width:' + size + 'px;height:' + size + 'px;--bfx-o:' + opacity + ';animation-delay:-' + delay + 'ms;animation-duration:' + duration + 'ms}';
      }
      return rules;
    }

    const STARS_CSS =
      starRules('bfx-stars.s1', 78, 20261104, 0.8, 2.1, 0.22, 0.85, 3800) +
      starRules('bfx-stars.s2', 52, 90210, 1.2, 2.8, 0.12, 0.4, 5200);

    const WORD_DELAYS = (() => {
      let rules = '';
      const total = 'DEEPSEEK HARNESS'.length;
      for (let index = 1; index <= total; index += 1) {
        rules += '.bfx-word > :nth-child(' + index + '){animation-delay:' + (520 + index * 30) + 'ms}';
      }
      return rules;
    })();

    const PHRASE_DELAYS = (() => {
      let rules = '';
      const total = '探索未至之境'.length;
      for (let index = 1; index <= total; index += 1) {
        rules += '.bfx-phrase > .bfx-pl:nth-child(' + index + '){animation-delay:' + (1120 + (index - 1) * 80) + 'ms}';
      }
      return rules;
    })();

    const CSS = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  display: block;
  z-index: 2147483647;
  pointer-events: auto;
}
.bfx-root {
  --bfx-bg-0: #05070f;
  --bfx-bg-1: #0a1030;
  --bfx-bg-2: #020308;
  --bfx-ink: #f4f7ff;
  --bfx-ink-dim: rgba(226, 233, 255, 0.64);
  --bfx-ink-faint: rgba(226, 233, 255, 0.52);
  --bfx-brand: #4d6bfe;
  --bfx-cyan: #6fe6ff;
  --bfx-violet: #b49bff;
  --bfx-line: rgba(140, 170, 255, 0.22);
  --bfx-dot: #dbe6ff;
  --bfx-aur1: rgba(77, 107, 254, 0.56);
  --bfx-aur2: rgba(111, 230, 255, 0.3);
  --bfx-aur3: rgba(180, 155, 255, 0.32);
  --bfx-vignette: rgba(0, 0, 0, 0.55);
  --bfx-mono: ui-monospace, "Cascadia Code", "SF Mono", Consolas, "Liberation Mono", monospace;
  font-family: "Montserrat", "Segoe UI", system-ui, -apple-system, sans-serif;
  position: fixed;
  inset: 0;
  overflow: hidden;
  opacity: 0;
  transition: opacity 280ms ease-out;
  color: var(--bfx-ink);
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  background: radial-gradient(128% 96% at 50% 38%, var(--bfx-bg-1) 0%, var(--bfx-bg-0) 48%, var(--bfx-bg-2) 100%);
}
.bfx-root.bfx-light {
  --bfx-bg-0: #eef4ff;
  --bfx-bg-1: #dbe7ff;
  --bfx-bg-2: #fbfdff;
  --bfx-ink: #0b0e16;
  --bfx-ink-dim: #3f4658;
  --bfx-ink-faint: #5f687c;
  --bfx-line: rgba(50, 80, 170, 0.24);
  --bfx-dot: #9db4e8;
  --bfx-brand: #2f55f5;
  --bfx-cyan: #0f93bf;
  --bfx-violet: #7a5cf0;
  --bfx-aur1: rgba(105, 145, 255, 0.5);
  --bfx-aur2: rgba(70, 190, 220, 0.26);
  --bfx-aur3: rgba(150, 120, 255, 0.3);
  --bfx-vignette: rgba(120, 140, 210, 0.14);
}
.bfx-light .bfx-stars { display: none; }
.bfx-root.bfx-visible { opacity: 1; }
.bfx-root.bfx-leaving { opacity: 0; transition: opacity ${EXIT_FADE_MS}ms ease-in; }
.bfx-root.bfx-leaving .bfx-stage { transform: scale(1.02); transition: transform ${EXIT_FADE_MS}ms ease-in; }
.bfx-bg { position: absolute; inset: 0; background: radial-gradient(70% 60% at 50% 42%, rgba(77, 107, 254, 0.14), transparent 70%); }
.bfx-light .bfx-bg { background: radial-gradient(70% 60% at 50% 42%, rgba(90, 135, 255, 0.26), transparent 72%); }
.bfx-stars { position: absolute; inset: 0; opacity: 0; animation: bfx-fade 800ms ease-out 80ms forwards; }
.bfx-stars span {
  position: absolute;
  border-radius: 50%;
  background: var(--bfx-dot);
  opacity: 0;
  animation-name: bfx-twinkle;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
}
.bfx-aurora {
  position: absolute;
  left: 50%;
  top: 44%;
  border-radius: 50%;
  filter: blur(68px);
  opacity: 0;
  transform: translate(-50%, -50%);
  animation: bfx-aurora-in 1800ms ease-out 80ms forwards, bfx-drift 22s ease-in-out 0ms infinite alternate;
}
.bfx-a1 { width: 118vmax; height: 58vmax; background: radial-gradient(closest-side, var(--bfx-aur1), transparent 70%); }
.bfx-a2 {
  width: 96vmax; height: 40vmax; top: 34%;
  background: radial-gradient(closest-side, var(--bfx-aur2), transparent 72%);
  animation: bfx-aurora-in 2200ms ease-out 260ms forwards, bfx-drift2 17s ease-in-out 0ms infinite alternate;
}
.bfx-a3 {
  width: 82vmax; height: 56vmax; top: 62%;
  background: radial-gradient(closest-side, var(--bfx-aur3), transparent 72%);
  animation: bfx-aurora-in 2400ms ease-out 420ms forwards, bfx-drift3 26s ease-in-out 0ms infinite alternate;
}
.bfx-vignette { position: absolute; inset: 0; background: radial-gradient(82% 74% at 50% 44%, transparent 42%, var(--bfx-vignette) 100%); }
.bfx-stage {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6vmin;
  box-sizing: border-box;
}
.bfx-mark {
  position: relative;
  width: min(33vmin, 212px);
  height: min(33vmin, 212px);
  display: grid;
  place-items: center;
  margin-bottom: clamp(16px, 3vmin, 32px);
}
.bfx-halo {
  position: absolute;
  inset: -16%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(77, 107, 254, 0.34), rgba(77, 107, 254, 0) 64%);
  filter: blur(12px);
  opacity: 0;
  animation: bfx-halo-in 900ms ease-out 160ms forwards, bfx-halo-pulse 3200ms ease-in-out 900ms infinite;
}
.bfx-light .bfx-halo { background: radial-gradient(circle, rgba(120, 160, 255, 0.3), rgba(120, 160, 255, 0) 64%); }
.bfx-ring-wrap {
  position: absolute;
  inset: -7%;
  opacity: 0;
  animation: bfx-fade 800ms ease-out 200ms forwards;
  filter: drop-shadow(0 0 5px rgba(111, 230, 255, 0.45));
}
.bfx-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
}
.bfx-ring.r1 {
  background: conic-gradient(from 20deg, transparent 0deg 20deg, #bff4ff 52deg, var(--bfx-cyan) 78deg, transparent 132deg 360deg);
  animation: bfx-spin 6200ms linear infinite;
}
.bfx-ring.r2 {
  inset: -9%;
  background: conic-gradient(from 200deg, transparent 0deg 34deg, #d9ccff 72deg, var(--bfx-violet) 96deg, transparent 158deg 360deg);
  animation: bfx-spin 9800ms linear reverse infinite;
}
.bfx-orbit { position: absolute; inset: -7%; border-radius: 50%; animation: bfx-spin 9200ms linear infinite; }
.bfx-orbit.o2 { inset: -13%; animation-duration: 14800ms; animation-direction: reverse; }
.bfx-orbit::before {
  content: "";
  position: absolute;
  top: -2px;
  left: calc(50% - 2px);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--bfx-cyan);
  box-shadow: 0 0 10px var(--bfx-cyan);
}
.bfx-orbit.o2::before {
  top: -1.5px;
  left: calc(50% - 1.5px);
  width: 3px;
  height: 3px;
  background: var(--bfx-violet);
  box-shadow: 0 0 9px var(--bfx-violet);
}
.bfx-whale {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 0 20px rgba(77, 107, 254, 0.55));
  opacity: 0;
  animation: bfx-whale-in 900ms cubic-bezier(0.2, 0.7, 0.2, 1) 100ms forwards;
}
.bfx-light .bfx-whale { filter: drop-shadow(0 10px 28px rgba(47, 85, 245, 0.35)); }
.bfx-whale-fill { opacity: 0; animation: bfx-fill 900ms ease-out 620ms forwards; }
.bfx-whale-stroke {
  stroke-width: 0.5;
  stroke-linejoin: round;
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  opacity: 0.9;
  animation: bfx-draw 1150ms cubic-bezier(0.65, 0, 0.35, 1) 160ms forwards;
}
.bfx-word {
  display: flex;
  align-items: baseline;
  font-size: clamp(18px, 2.55vmin, 27px);
  font-weight: 600;
  letter-spacing: 0.15em;
  line-height: 1.1;
  color: var(--bfx-ink);
  white-space: nowrap;
  text-shadow: 0 0 30px rgba(140, 175, 255, 0.25);
}
.bfx-light .bfx-word { text-shadow: none; }
.bfx-l {
  display: inline-block;
  opacity: 0;
  transform: translateY(0.45em);
  filter: blur(5px);
  animation: bfx-letter-in 560ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.bfx-gap { display: inline-block; width: 0.42em; }
.bfx-sub {
  margin-top: clamp(9px, 1.5vmin, 15px);
  font-family: var(--bfx-mono);
  font-size: clamp(10.5px, 1.2vmin, 12.5px);
  letter-spacing: 0.38em;
  text-indent: 0.38em;
  color: var(--bfx-ink-dim);
  white-space: nowrap;
  opacity: 0;
  animation: bfx-sub-in 700ms ease-out 980ms forwards;
}
.bfx-progress {
  position: relative;
  width: min(46vmin, 302px);
  height: 2px;
  margin-top: clamp(16px, 2.6vmin, 28px);
  border-radius: 2px;
  background: var(--bfx-line);
  overflow: hidden;
}
.bfx-bar {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  transform: scaleX(0);
  border-radius: inherit;
  background: linear-gradient(90deg, var(--bfx-brand), var(--bfx-cyan));
  box-shadow: 0 0 12px rgba(111, 230, 255, 0.65);
  animation: bfx-bar 1250ms cubic-bezier(0.3, 0.7, 0.2, 1) 980ms forwards;
}
.bfx-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: clamp(10px, 1.6vmin, 16px);
  font-family: var(--bfx-mono);
  font-size: 10.5px;
  letter-spacing: 0.26em;
  text-indent: 0.26em;
  color: var(--bfx-ink-faint);
  opacity: 0;
  animation: bfx-fade 800ms ease-out 520ms forwards;
}
.bfx-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--bfx-cyan);
  box-shadow: 0 0 9px var(--bfx-cyan);
  animation: bfx-dot 1300ms ease-in-out infinite;
}
.bfx-log {
  position: absolute;
  left: clamp(20px, 3.8vmin, 46px);
  bottom: clamp(18px, 3.4vmin, 40px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: var(--bfx-mono);
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--bfx-ink-faint);
  opacity: 0;
  animation: bfx-fade 700ms ease-out 640ms forwards;
}
.bfx-light .bfx-log { color: #5b6478; }
.bfx-log-line {
  display: flex;
  gap: 0.9em;
  opacity: 0;
  transform: translateY(4px);
  animation: bfx-log-in 520ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.bfx-log-line:nth-child(1) { animation-delay: 700ms; }
.bfx-log-line:nth-child(2) { animation-delay: 860ms; }
.bfx-log-line:nth-child(3) { animation-delay: 1020ms; }
.bfx-log-line:nth-child(4) { animation-delay: 1180ms; }
.bfx-log-tag { color: var(--bfx-cyan); opacity: 0.85; }
.bfx-light .bfx-log-tag { color: #1c6f8f; opacity: 0.9; }
.bfx-log-msg { color: var(--bfx-ink-faint); }
.bfx-light .bfx-log-msg { color: #5b6478; }
.bfx-hint {
  position: absolute;
  right: clamp(20px, 3.8vmin, 46px);
  bottom: clamp(18px, 3.4vmin, 40px);
  font-family: var(--bfx-mono);
  font-size: 10.5px;
  letter-spacing: 0.14em;
  color: var(--bfx-ink-dim);
  opacity: 0;
  animation: bfx-fade 650ms ease-out 1250ms forwards;
}
.bfx-corner {
  position: absolute;
  left: clamp(20px, 3.8vmin, 46px);
  top: clamp(18px, 3.4vmin, 40px);
  font-family: var(--bfx-mono);
  font-size: 10.5px;
  letter-spacing: 0.24em;
  color: var(--bfx-ink-faint);
  opacity: 0;
  animation: bfx-fade 800ms ease-out 400ms forwards;
}
.bfx-corner::after {
  content: "";
  display: inline-block;
  width: 0.5em;
  height: 1.05em;
  margin-left: 0.5em;
  vertical-align: -0.15em;
  background: var(--bfx-cyan);
  opacity: 0.75;
  animation: bfx-blink 1100ms steps(1) infinite;
}
/* ---- physical water-surface finale: 探索未至之境 rises out of the water ---- */
.bfx-water {
  position: relative;
  width: min(78vmin, 660px);
  margin-top: clamp(20px, 3vmin, 32px);
  display: flex;
  flex-direction: column;
  align-items: center;
  isolation: isolate;
}
.bfx-phrase {
  position: relative;
  z-index: 7;
  width: 100%;
  height: 1.42em;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.2em;
  overflow: hidden;
  font-size: clamp(14px, 1.95vmin, 19px);
  font-weight: 300;
  letter-spacing: 0.3em;
  color: var(--bfx-ink-dim);
  text-shadow: 0 0 22px rgba(111, 230, 255, 0.25);
}
.bfx-light .bfx-phrase { color: #3f4658; text-shadow: 0 0 18px rgba(15, 147, 191, 0.18); }
.bfx-pl {
  display: inline-block;
  opacity: 0;
  transform: translateY(135%);
  filter: blur(9px);
  animation: bfx-emerge 850ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.bfx-waterline {
  position: relative;
  z-index: 6;
  width: 100%;
  height: 1px;
  margin-top: 2px;
  background: linear-gradient(90deg, transparent 0%, var(--bfx-cyan) 16%, #eefcff 50%, var(--bfx-cyan) 84%, transparent 100%);
  box-shadow: 0 0 12px rgba(111, 230, 255, 0.28);
  opacity: 0;
  animation: bfx-water-in 1200ms ease-out 900ms forwards;
}
.bfx-waterline::after {
  content: "";
  position: absolute;
  top: -2px;
  left: 50%;
  width: 30%;
  height: 4px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(50% 100% at 50% 50%, #ffffff, rgba(255, 255, 255, 0) 70%);
  filter: blur(1px);
  opacity: 0.6;
  animation: bfx-glint 5200ms ease-in-out 1200ms infinite;
}
.bfx-light .bfx-waterline {
  background: linear-gradient(90deg, transparent 0%, var(--bfx-cyan) 18%, #d8f4ff 50%, var(--bfx-cyan) 82%, transparent 100%);
  box-shadow: 0 0 14px rgba(15, 147, 191, 0.3);
}
.bfx-waterbody {
  position: absolute;
  top: calc(100% + 1px);
  left: 0;
  right: 0;
  z-index: 0;
  height: clamp(72px, 12vmin, 132px);
  pointer-events: none;
  background: linear-gradient(180deg, rgba(140, 215, 255, 0.26) 0%, rgba(70, 140, 235, 0.14) 22%, rgba(24, 50, 120, 0.07) 55%, rgba(10, 20, 50, 0) 100%);
  filter: blur(8px);
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%);
  opacity: 0;
  animation: bfx-fade 1500ms ease-out 950ms forwards;
}
.bfx-light .bfx-waterbody {
  background: linear-gradient(180deg, rgba(15, 147, 191, 0.2) 0%, rgba(40, 120, 190, 0.1) 30%, rgba(120, 180, 235, 0) 100%);
}
.bfx-mist {
  position: absolute;
  left: -6%;
  right: -6%;
  bottom: calc(100% + 2px);
  z-index: 3;
  height: clamp(26px, 4.5vmin, 46px);
  pointer-events: none;
  background: linear-gradient(0deg, rgba(150, 220, 255, 0.16), rgba(150, 220, 255, 0) 88%);
  filter: blur(7px);
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 14%, #000 86%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 14%, #000 86%, transparent 100%);
  opacity: 0;
  animation: bfx-fade 1600ms ease-out 900ms forwards;
}
.bfx-light .bfx-mist { background: linear-gradient(0deg, rgba(15, 147, 191, 0.12), rgba(15, 147, 191, 0) 88%); }
.bfx-waves {
  position: absolute;
  top: calc(100% + 1px);
  left: 0;
  right: 0;
  z-index: 2;
  height: clamp(28px, 4.4vmin, 42px);
  overflow: hidden;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.65) 45%, transparent 100%);
  mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.65) 45%, transparent 100%);
}
.bfx-wave {
  position: absolute;
  left: -60%;
  width: 220%;
  height: 1px;
  filter: blur(0.6px);
  opacity: 0;
  background: linear-gradient(90deg, transparent 0 6%, rgba(196, 242, 255, 0.5) 12% 18%, transparent 26% 42%, rgba(170, 235, 255, 0.4) 50% 56%, transparent 64% 76%, rgba(150, 225, 255, 0.32) 84% 89%, transparent 96%);
  animation: bfx-wave-in 1600ms ease-out 1000ms forwards, bfx-wave-drift-a 26s linear 1200ms infinite alternate;
}
.bfx-wave.w2 {
  top: 11px;
  filter: blur(1px);
  background: linear-gradient(90deg, transparent 0 18%, rgba(170, 235, 255, 0.34) 28% 38%, transparent 50% 68%, rgba(150, 225, 255, 0.26) 78% 86%, transparent 94%);
  animation: bfx-wave-in 1800ms ease-out 1150ms forwards, bfx-wave-drift-b 36s linear 900ms infinite alternate;
}
.bfx-wave.w3 {
  top: 22px;
  filter: blur(1.4px);
  background: linear-gradient(90deg, transparent 0 12%, rgba(150, 225, 255, 0.22) 24% 34%, transparent 48% 72%, rgba(150, 225, 255, 0.18) 82% 90%, transparent 96%);
  animation: bfx-wave-in 2000ms ease-out 1300ms forwards, bfx-wave-drift-c 46s linear 1500ms infinite alternate;
}
.bfx-light .bfx-wave { filter: blur(0.7px); opacity: 0.8; }
.bfx-reflection {
  --bfx-reflect-opacity: 0.78;
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  right: 0;
  z-index: 1;
  text-align: center;
  white-space: nowrap;
  font-size: clamp(14px, 1.95vmin, 19px);
  font-weight: 300;
  letter-spacing: 0.3em;
  color: #a9c1e8;
  transform: scaleY(-1);
  filter: blur(2.2px);
  opacity: 0;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent 78%), repeating-linear-gradient(180deg, rgba(0, 0, 0, 0.95) 0 1.5px, rgba(0, 0, 0, 0.45) 1.5px 4px);
  -webkit-mask-composite: source-in;
  mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent 78%), repeating-linear-gradient(180deg, rgba(0, 0, 0, 0.95) 0 1.5px, rgba(0, 0, 0, 0.45) 1.5px 4px);
  mask-composite: intersect;
  animation: bfx-reflect-in 1200ms ease-out 1900ms forwards, bfx-reflect-wobble 5600ms ease-in-out 1900ms infinite alternate;
}
.bfx-light .bfx-reflection {
  --bfx-reflect-opacity: 0.72;
  color: #3f4a63;
}
.bfx-ripples,
.bfx-drops,
.bfx-sparks {
  position: absolute;
  top: calc(100% + 1px);
  left: 0;
  right: 0;
  height: 0;
  z-index: 4;
  pointer-events: none;
}
.bfx-ripple {
  position: absolute;
  left: 50%;
  top: -4px;
  width: 58px;
  height: 10px;
  margin-left: -29px;
  border: 1px solid rgba(111, 230, 255, 0.55);
  border-radius: 50%;
  opacity: 0;
  animation: bfx-ripple 3400ms ease-out infinite;
}
.bfx-light .bfx-ripple { border-color: rgba(15, 147, 191, 0.42); }
.bfx-ripple:nth-child(1) { animation-delay: 1000ms; }
.bfx-ripple:nth-child(2) { animation-delay: 1750ms; }
.bfx-ripple:nth-child(3) { animation-delay: 2500ms; }
.bfx-ripple:nth-child(4) { animation-delay: 3250ms; }
.bfx-ripple:nth-child(5) { animation-delay: 4000ms; }
.bfx-spark {
  position: absolute;
  top: -2px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #e6fbff;
  box-shadow: 0 0 9px var(--bfx-cyan);
  opacity: 0;
  animation: bfx-spark 2300ms ease-out infinite;
}
.bfx-light .bfx-spark { background: #0f93bf; box-shadow: 0 0 8px rgba(15, 147, 191, 0.7); }
.bfx-spark:nth-child(1) { left: 34%; animation-delay: 1250ms; }
.bfx-spark:nth-child(2) { left: 47%; animation-delay: 1750ms; }
.bfx-spark:nth-child(3) { left: 61%; animation-delay: 2150ms; }
.bfx-spark:nth-child(4) { left: 55%; animation-delay: 2650ms; }
.bfx-drop {
  position: absolute;
  top: -3px;
  width: 2px;
  height: 5px;
  border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
  background: #eaf9ff;
  box-shadow: 0 0 6px rgba(140, 225, 255, 0.7);
  opacity: 0;
  animation: bfx-drop 2400ms cubic-bezier(0.3, 0.1, 0.6, 1) infinite;
}
.bfx-light .bfx-drop { background: #2b8fb5; box-shadow: 0 0 5px rgba(15, 147, 191, 0.5); }
.bfx-drop:nth-child(1) { left: 30%; animation-delay: 1250ms; }
.bfx-drop:nth-child(2) { left: 42%; animation-delay: 1550ms; }
.bfx-drop:nth-child(3) { left: 53%; animation-delay: 1850ms; }
.bfx-drop:nth-child(4) { left: 47%; animation-delay: 2150ms; }
.bfx-drop:nth-child(5) { left: 64%; animation-delay: 2450ms; }
.bfx-drop:nth-child(6) { left: 58%; animation-delay: 2750ms; }
.bfx-flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(circle at 50% 46%, rgba(168, 202, 255, 0.55), rgba(168, 202, 255, 0) 58%);
}
.bfx-root.bfx-leaving .bfx-flash { animation: bfx-flash ${EXIT_FADE_MS}ms ease-out forwards; }
.bfx-root.bfx-welcome .bfx-corner::before { content: "WELCOME"; }
.bfx-root.bfx-reduced * { animation-duration: 1ms !important; animation-delay: 0ms !important; transition: none !important; }
.bfx-root.bfx-reduced .bfx-l { opacity: 1; transform: none; filter: none; }
.bfx-root.bfx-reduced .bfx-whale { opacity: 1; }
.bfx-root.bfx-reduced .bfx-whale-fill { opacity: 1; }
.bfx-root.bfx-reduced .bfx-whale-stroke { stroke-dashoffset: 0; }
.bfx-root.bfx-reduced .bfx-aurora { opacity: 0.5; animation: none !important; }
.bfx-root.bfx-reduced .bfx-ring,
.bfx-root.bfx-reduced .bfx-halo,
.bfx-root.bfx-reduced .bfx-orbit { animation: none !important; }
.bfx-root.bfx-reduced .bfx-orbit { display: none; }
.bfx-root.bfx-reduced .bfx-ring-wrap { opacity: 0.7; }
.bfx-root.bfx-reduced .bfx-halo { opacity: 0.7; }
.bfx-root.bfx-reduced .bfx-orbit::before { opacity: 0.8; }
.bfx-root.bfx-reduced .bfx-stars { opacity: 0.5; }
.bfx-root.bfx-reduced .bfx-stars span { animation: none !important; opacity: 0.4; }
.bfx-root.bfx-reduced .bfx-bar { animation: none !important; transform: scaleX(0.86); }
.bfx-root.bfx-reduced .bfx-pl { opacity: 1; transform: none; filter: none; }
.bfx-root.bfx-reduced .bfx-ripple,
.bfx-root.bfx-reduced .bfx-spark,
.bfx-root.bfx-reduced .bfx-drop { display: none; }
.bfx-root.bfx-reduced .bfx-wave { display: none; }
.bfx-root.bfx-reduced .bfx-waterline { opacity: 1; }
.bfx-root.bfx-reduced .bfx-waterbody { opacity: 1; }
.bfx-root.bfx-reduced .bfx-mist { opacity: 1; }
.bfx-root.bfx-reduced .bfx-reflection { opacity: 0.14; }
@media (max-width: 640px) {
  .bfx-log { display: none; }
  .bfx-word { font-size: 15px; letter-spacing: 0.1em; }
  .bfx-sub { letter-spacing: 0.24em; text-indent: 0.24em; }
  .bfx-phrase,
  .bfx-reflection { font-size: 13px; letter-spacing: 0.18em; }
  .bfx-water { width: 90%; }
}
@keyframes bfx-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes bfx-twinkle { 0%, 100% { opacity: var(--bfx-o, 0.5); } 50% { opacity: 0.04; } }
@keyframes bfx-aurora-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes bfx-drift {
  0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  100% { transform: translate(-46%, -45%) rotate(9deg) scale(1.12); }
}
@keyframes bfx-drift2 {
  0% { transform: translate(-50%, -50%) rotate(0deg) scale(1.04); }
  100% { transform: translate(-54%, -47%) rotate(-12deg) scale(0.94); }
}
@keyframes bfx-drift3 {
  0% { transform: translate(-50%, -50%) rotate(0deg) scale(0.96); }
  100% { transform: translate(-45%, -53%) rotate(14deg) scale(1.08); }
}
@keyframes bfx-halo-in { from { opacity: 0; transform: scale(0.62); } to { opacity: 1; transform: scale(1); } }
@keyframes bfx-halo-pulse { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
@keyframes bfx-spin { to { transform: rotate(360deg); } }
@keyframes bfx-whale-in { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
@keyframes bfx-draw { to { stroke-dashoffset: 0; } }
@keyframes bfx-fill { from { opacity: 0; } to { opacity: 1; } }
@keyframes bfx-letter-in { to { opacity: 1; transform: none; filter: blur(0); } }
@keyframes bfx-sub-in { from { opacity: 0; letter-spacing: 0.62em; } to { opacity: 1; letter-spacing: 0.38em; } }
@keyframes bfx-bar { to { transform: scaleX(0.86); } }
@keyframes bfx-dot { 0%, 100% { opacity: 0.35; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
@keyframes bfx-log-in { to { opacity: 1; transform: none; } }
@keyframes bfx-blink { 0%, 49% { opacity: 0.75; } 50%, 100% { opacity: 0; } }
@keyframes bfx-flash { 0% { opacity: 0; } 28% { opacity: 0.9; } 100% { opacity: 0; } }
@keyframes bfx-emerge { to { opacity: 1; transform: translateY(0); filter: blur(0); } }
@keyframes bfx-water-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes bfx-glint {
  0%, 100% { transform: translateX(-50%) scaleX(0.4); opacity: 0.35; }
  50% { transform: translateX(-50%) scaleX(1.2); opacity: 0.9; }
}
@keyframes bfx-ripple {
  0% { opacity: 0; transform: scale(0.2); }
  14% { opacity: 0.5; }
  100% { opacity: 0; transform: scale(3.4); }
}
@keyframes bfx-spark {
  0% { opacity: 0; transform: translateY(0) scale(0.6); }
  18% { opacity: 0.85; }
  100% { opacity: 0; transform: translateY(-30px) scale(1); }
}
@keyframes bfx-reflect-in { to { opacity: var(--bfx-reflect-opacity, 0.32); } }
@keyframes bfx-reflect-wobble {
  0% { transform: scaleY(-1) translateY(0) skewX(0deg); }
  50% { transform: scaleY(-1) translateY(1.5px) skewX(0.45deg); }
  100% { transform: scaleY(-1) translateY(0.5px) skewX(-0.35deg); }
}
@keyframes bfx-wave-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes bfx-wave-drift-a {
  0% { transform: translateX(-16%); }
  100% { transform: translateX(2%); }
}
@keyframes bfx-wave-drift-b {
  0% { transform: translateX(0%); }
  100% { transform: translateX(-18%); }
}
@keyframes bfx-wave-drift-c {
  0% { transform: translateX(-9%); }
  100% { transform: translateX(7%); }
}
@keyframes bfx-drop {
  0% { opacity: 0; transform: translateY(0) scaleY(0.5); }
  12% { opacity: 0.9; transform: translateY(-2px) scaleY(1); }
  55% { opacity: 0.75; transform: translateY(-16px) scaleY(1.05); }
  85% { opacity: 0.35; transform: translateY(-3px) scaleY(0.9); }
  100% { opacity: 0; transform: translateY(2px) scaleY(0.6); }
}
` + STARS_CSS + WORD_DELAYS + PHRASE_DELAYS;

    /** One pace for everything: stylesheet milliseconds scaled by {@link SPEED}. */
    const SCALED_CSS = scaleCssTimes(CSS, SPEED);

    /* --------------------------------------------------------------------- */
    /* DOM construction                                                      */
    /* --------------------------------------------------------------------- */

    function attachStyle(shadow, css) {
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        shadow.adoptedStyleSheets = [sheet];
        return;
      } catch (error) {
        /* Constructed sheets unavailable — fall back to a <style> element. */
      }
      const style = el('style');
      style.textContent = css;
      shadow.appendChild(style);
    }

    function buildTree(shadow, theme, copy, reduced) {
      const gradientId = 'bfx-grad-' + Math.random().toString(36).slice(2, 8);
      const root = el('div', 'bfx-root' + (theme === 'light' ? ' bfx-light' : '') + (reduced ? ' bfx-reduced' : ''));

      const starsA = el('div', 'bfx-stars s1');
      for (let index = 0; index < 78; index += 1) starsA.appendChild(el('span'));
      const starsB = el('div', 'bfx-stars s2');
      for (let index = 0; index < 52; index += 1) starsB.appendChild(el('span'));

      const auroraA = el('div', 'bfx-aurora bfx-a1');
      const auroraB = el('div', 'bfx-aurora bfx-a2');
      const auroraC = el('div', 'bfx-aurora bfx-a3');
      const vignette = el('div', 'bfx-vignette');

      const mark = el('div', 'bfx-mark');
      const halo = el('div', 'bfx-halo');
      const ringWrap = el('div', 'bfx-ring-wrap');
      ringWrap.appendChild(el('div', 'bfx-ring r1'));
      ringWrap.appendChild(el('div', 'bfx-ring r2'));
      ringWrap.appendChild(el('div', 'bfx-orbit o1'));
      ringWrap.appendChild(el('div', 'bfx-orbit o2'));

      const svg = s('svg', {
        class: 'bfx-whale',
        viewBox: '0 0 50 50',
        fill: 'none',
        'aria-hidden': 'true',
        focusable: 'false'
      });
      const defs = s('defs');
      const gradient = s('linearGradient', {
        id: gradientId,
        x1: '5',
        y1: '4',
        x2: '45',
        y2: '46',
        gradientUnits: 'userSpaceOnUse'
      });
      const whaleStops =
        theme === 'light'
          ? [['0', '#7fa2ff'], ['0.42', '#2f55f5'], ['1', '#7c5cff']]
          : [['0', '#9dc2ff'], ['0.42', '#4d6bfe'], ['1', '#9b86ff']];
      whaleStops.forEach(([offset, color]) => {
        gradient.appendChild(s('stop', { offset, 'stop-color': color }));
      });
      defs.appendChild(gradient);
      const strokePath = s('path', {
        class: 'bfx-whale-stroke',
        d: WHALE_PATH,
        fill: 'none',
        stroke: 'url(#' + gradientId + ')',
        pathLength: '1000',
        'stroke-linecap': 'round'
      });
      const fillPath = s('path', { class: 'bfx-whale-fill', d: WHALE_PATH, fill: 'url(#' + gradientId + ')' });
      svg.appendChild(defs);
      svg.appendChild(fillPath);
      svg.appendChild(strokePath);
      mark.appendChild(halo);
      mark.appendChild(ringWrap);
      mark.appendChild(svg);

      const word = el('div', 'bfx-word');
      word.setAttribute('aria-label', 'DEEPSEEK HARNESS');
      for (const character of 'DEEPSEEK HARNESS') {
        if (character === ' ') {
          const gap = el('span', 'bfx-gap');
          gap.textContent = '\u00a0';
          gap.setAttribute('aria-hidden', 'true');
          word.appendChild(gap);
        } else {
          const letter = el('span', 'bfx-l', character);
          letter.setAttribute('aria-hidden', 'true');
          word.appendChild(letter);
        }
      }

      const sub = el('div', 'bfx-sub', copy.sub);
      const progress = el('div', 'bfx-progress');
      progress.appendChild(el('div', 'bfx-bar'));
      const status = el('div', 'bfx-status');
      status.appendChild(el('span', 'bfx-dot'));
      const statusText = el('span', 'bfx-status-text', copy.status[0]);
      status.appendChild(statusText);

      const water = el('div', 'bfx-water');
      const phrase = el('div', 'bfx-phrase');
      phrase.setAttribute('aria-label', copy.phrase);
      for (const character of copy.phrase) {
        const letter = el('span', 'bfx-pl', character);
        letter.setAttribute('aria-hidden', 'true');
        phrase.appendChild(letter);
      }
      const reflection = el('div', 'bfx-reflection', copy.phrase);
      reflection.setAttribute('aria-hidden', 'true');
      const waterline = el('div', 'bfx-waterline');
      const mist = el('div', 'bfx-mist');
      const waterbody = el('div', 'bfx-waterbody');
      const waves = el('div', 'bfx-waves');
      waves.appendChild(el('span', 'bfx-wave w1'));
      waves.appendChild(el('span', 'bfx-wave w2'));
      waves.appendChild(el('span', 'bfx-wave w3'));
      const ripples = el('div', 'bfx-ripples');
      for (let index = 0; index < 5; index += 1) ripples.appendChild(el('span', 'bfx-ripple'));
      const drops = el('div', 'bfx-drops');
      for (let index = 0; index < 6; index += 1) drops.appendChild(el('span', 'bfx-drop'));
      const sparks = el('div', 'bfx-sparks');
      for (let index = 0; index < 4; index += 1) sparks.appendChild(el('span', 'bfx-spark'));
      water.appendChild(phrase);
      water.appendChild(reflection);
      water.appendChild(waterline);
      water.appendChild(mist);
      water.appendChild(waterbody);
      water.appendChild(waves);
      water.appendChild(ripples);
      water.appendChild(drops);
      water.appendChild(sparks);

      const stage = el('div', 'bfx-stage');
      stage.appendChild(mark);
      stage.appendChild(word);
      stage.appendChild(sub);
      stage.appendChild(progress);
      stage.appendChild(status);
      stage.appendChild(water);

      const log = el('div', 'bfx-log');
      for (const [tag, message] of copy.logs) {
        const line = el('div', 'bfx-log-line');
        line.appendChild(el('span', 'bfx-log-tag', tag));
        line.appendChild(el('span', 'bfx-log-msg', message));
        log.appendChild(line);
      }

      const hint = el('div', 'bfx-hint', copy.hint);
      const corner = el('div', 'bfx-corner', copy.corner);
      const flash = el('div', 'bfx-flash');

      root.appendChild(auroraA);
      root.appendChild(auroraB);
      root.appendChild(auroraC);
      root.appendChild(starsA);
      root.appendChild(starsB);
      root.appendChild(vignette);
      root.appendChild(stage);
      root.appendChild(log);
      root.appendChild(hint);
      root.appendChild(corner);
      root.appendChild(flash);

      shadow.appendChild(root);
      return { root, statusText };
    }

    /* --------------------------------------------------------------------- */
    /* ready detection                                                       */
    /* --------------------------------------------------------------------- */

    function rootNode() {
      return document.getElementById('root');
    }

    /**
     * The kernel-owned boot mask is a DIRECT child of #root. Scope the lookup to
     * direct children: a plugin overlay is free to carry its own data attributes.
     */
    function bootMask() {
      const root = rootNode();
      return root === null ? null : root.querySelector(':scope > [data-dsh-boot]');
    }

    /** The app is mounted once React's BootHandoff has replaced the boot mask. */
    function appMounted() {
      const root = rootNode();
      return root !== null && root.querySelector(':scope > [data-dsh-boot]') === null;
    }

    /**
     * The kernel builds the boot mask together with its spinner in one commit.
     * A mask that keeps the spinner is loading; a mask whose spinner disappears
     * is the documented failure card. mount() tracks the spinner over time and
     * decides with a grace window, so this predicate is not used directly.
     */

    /* --------------------------------------------------------------------- */
    /* overlay lifecycle                                                     */
    /* --------------------------------------------------------------------- */

    function mount(live) {
      const theme = document.body && document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light';
      const copy = COPY[IS_ZH ? 'zh' : 'en'];
      const reduced = prefersReducedMotion();
      const host = document.createElement('div');
      host.setAttribute(OVERLAY_ATTR, '');
      const shadow = host.attachShadow({ mode: 'open' });
      attachStyle(shadow, SCALED_CSS);
      const { root, statusText } = buildTree(shadow, theme, copy, reduced);
      if (live) root.classList.add('bfx-welcome');
      (document.body || document.documentElement).appendChild(host);

      const timers = new Set();
      let disposed = false;
      let exited = false;
      let finished = false;
      const minShow = reduced ? Math.round(950 * SPEED) : live ? LIVE_SHOW_MS : MIN_SHOW_MS;
      const startedAt = performance.now();

      const schedule = (callback, delay) => {
        const id = window.setTimeout(() => {
          timers.delete(id);
          if (!disposed && !exited) callback();
        }, delay);
        timers.add(id);
        return id;
      };

      function clearTimers() {
        for (const id of timers) window.clearTimeout(id);
        timers.clear();
      }

      function removeListeners() {
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('pointerdown', onPointer, true);
      }

      function clean() {
        clearTimers();
        window.clearInterval(poll);
        observer.disconnect();
        removeListeners();
        host.remove();
      }

      function finish(reason) {
        if (exited || disposed) return;
        exited = true;
        clearTimers();
        removeListeners();
        statusText.textContent = copy.status[2];
        root.classList.add('bfx-leaving');
        window.setTimeout(() => {
          if (disposed) return;
          clean();
          finished = true;
        }, EXIT_MS + 40);
      }

      function markReady() {
        if (exited || disposed || readyScheduled) return;
        readyScheduled = true;
        statusText.textContent = copy.status[2];
        const remaining = Math.max(40, minShow - (performance.now() - startedAt));
        schedule(() => finish('ready'), remaining);
      }

      function onKey(event) {
        if (event.key === 'Escape' || event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          finish('skip');
        }
      }

      function onPointer(event) {
        event.preventDefault();
        event.stopPropagation();
        finish('skip');
      }

      let sawBoot = bootMask() !== null;
      const mountedAt = performance.now();
      let sawSpinner = false;
      let readyScheduled = false;
      const noteSpinner = () => {
        const mask = bootMask();
        if (mask !== null && mask.querySelector('[data-dsh-boot-spinner]') !== null) sawSpinner = true;
      };
      noteSpinner();
      const settleIfFinished = () => {
        if (exited || disposed) return false;
        if (appMounted()) {
          observer.disconnect();
          if (!live) markReady();
          return true;
        }
        const mask = bootMask();
        if (mask !== null) {
          noteSpinner();
          const maskAge = performance.now() - mountedAt;
          // The kernel builds the mask together with its spinner, so a mask that
          // never showed one is a failure card (or a future boot UI): give it one
          // grace window before revealing it. A mask that HAD a spinner and lost
          // it is the documented failure signal and may be revealed at once.
          if (!sawSpinner && maskAge > 1200) {
            observer.disconnect();
            finish('boot-failed');
            return true;
          }
          if (sawSpinner && maskAge > 400 && mask.querySelector('[data-dsh-boot-spinner]') === null) {
            observer.disconnect();
            finish('boot-failed');
            return true;
          }
        }
        return false;
      };
      const observer = new MutationObserver(() => {
        if (exited || disposed) return;
        if (!sawBoot && bootMask() !== null) sawBoot = true;
        settleIfFinished();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      // A failure commit can arrive without a childList mutation we observe in
      // time; the poll is the cheap belt-and-braces signal the boot contract
      // documents (spinner removal is the only failure marker).
      const poll = window.setInterval(() => {
        settleIfFinished();
      }, 400);

      if (!live) {
        settleIfFinished();
        schedule(() => finish('timeout'), MAX_SHOW_MS);
        schedule(() => {
          if (!exited) statusText.textContent = copy.status[1];
        }, Math.round(620 * SPEED));
      } else {
        schedule(() => finish('welcome'), minShow);
      }

      window.addEventListener('keydown', onKey, true);
      window.addEventListener('pointerdown', onPointer, true);

      requestAnimationFrame(() => {
        if (!disposed && !exited) root.classList.add('bfx-visible');
      });

      return {
        host,
        get finished() {
          return finished;
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          clean();
        }
      };
    }

    /* --------------------------------------------------------------------- */
    /* entry                                                                 */
    /* --------------------------------------------------------------------- */

    let current = null;

    function start(liveOverride) {
      try {
        if (!enabled()) return null;
        if (document.querySelector('[' + OVERLAY_ATTR + ']')) return null;
        const fresh = performance.now() < FRESH_WINDOW_MS;
        const live = liveOverride === true || !fresh;
        if (live && storageGet('sessionStorage', SESSION_KEY) === '1') return null;
        if (live) storageSet('sessionStorage', SESSION_KEY, '1');
        current = mount(live);
        return current;
      } catch (error) {
        try {
          console.warn('[dsh-boot-fx] boot splash skipped:', error);
        } catch (ignored) {
          /* ignore */
        }
        return null;
      }
    }

    function installDebugHandle() {
      if (window.__dshBootFx) return;
      window.__dshBootFx = {
        version: VERSION,
        package: PACKAGE_ID,
        speed: SPEED,
        /** Persist a new pacing multiplier; it applies on the next page load. */
        setSpeed(value) {
          const next = Number(value);
          if (!Number.isFinite(next) || next < 0.6 || next > 2.5) return false;
          storageSet('localStorage', 'dsh.bootFx.speed', String(next));
          return true;
        },
        replay() {
          storageRemove('localStorage', STORAGE_KEY);
          storageRemove('sessionStorage', SESSION_KEY);
          if (current) current.dispose();
          current = null;
          return start(true) !== null;
        },
        off() {
          storageSet('localStorage', STORAGE_KEY, 'off');
        },
        on() {
          storageRemove('localStorage', STORAGE_KEY);
        }
      };
    }

    function apply(ctx) {
      try {
        installDebugHandle();
        if (document.readyState === 'loading') {
          const onReady = () => {
            document.removeEventListener('DOMContentLoaded', onReady);
            if (ctx && typeof ctx.effect === 'function') {
              ctx.effect(() => {
                const instance = start();
                return () => {
                  if (instance) instance.dispose();
                };
              }, 'dsh-boot-fx: boot splash');
            } else {
              start();
            }
          };
          document.addEventListener('DOMContentLoaded', onReady, { once: true });
          if (ctx && typeof ctx.effect === 'function') {
            ctx.effect(() => () => document.removeEventListener('DOMContentLoaded', onReady), 'dsh-boot-fx: dom gate');
          }
          return;
        }
        if (ctx && typeof ctx.effect === 'function') {
          ctx.effect(() => {
            const instance = start();
            return () => {
              if (instance) instance.dispose();
            };
          }, 'dsh-boot-fx: boot splash');
        } else {
          start();
        }
      } catch (error) {
        try {
          console.warn('[dsh-boot-fx] apply failed:', error);
        } catch (ignored) {
          /* ignore */
        }
      }
    }

    return { inject: [], apply };
  }
});
