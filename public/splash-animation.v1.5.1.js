(() => {
  const buildLoader = () => {
    const wrapper = document.createElement('div')
    wrapper.className = 's2p-loader'
    wrapper.setAttribute('role','status')
    wrapper.setAttribute('aria-live','polite')
    wrapper.innerHTML = `
      <div class="s2p-loader-scene" aria-hidden="true">
        <div class="s2p-loader-trail"></div>
        <div class="s2p-loader-ball-track">
          <div class="s2p-loader-ball"></div>
          <div class="s2p-loader-shadow"></div>
        </div>
        <div class="s2p-loader-pitch">
          <img src="/assets/brand-mark.png" alt="">
        </div>
      </div>
      <div class="s2p-loader-text">Opening <b>Stats2Pitch</b>...</div>
      <div class="s2p-loader-sub">From stats to the pitch</div>`
    return wrapper
  }

  const upgradeSplash = root => {
    if (!root) return
    const splash = root.querySelector('.splash')
    if (!splash || splash.dataset.s2pAnimated === '1') return
    splash.dataset.s2pAnimated = '1'
    splash.replaceWith(buildLoader())
  }

  const root = document.getElementById('root')
  upgradeSplash(root)

  if (root) {
    const observer = new MutationObserver(() => upgradeSplash(root))
    observer.observe(root, {childList:true, subtree:true})
  }
})()
