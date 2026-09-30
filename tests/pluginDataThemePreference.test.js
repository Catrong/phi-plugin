import assert from 'node:assert/strict'
import test from 'node:test'
import PluginData from '../model/user/pluginData.js'
import themeManager from '../model/theme/manager.js'

test('temporary theme policy denial keeps the persisted user preference', () => {
    const originalIsCustomTheme = themeManager.isCustomTheme
    const originalIsThemeAvailable = themeManager.isThemeAvailable
    let available = false
    themeManager.isCustomTheme = themeId => themeId === 'milthm'
    themeManager.isThemeAvailable = themeId => themeId === 'milthm' && available

    try {
        const denied = new PluginData({ theme: 'milthm' })
        assert.equal(denied.theme, 'default')
        assert.equal(denied.themePreference, 'milthm')
        const persisted = JSON.parse(JSON.stringify(denied))
        assert.equal(persisted.theme, 'milthm')
        assert.equal('themePreference' in persisted, false)

        available = true
        const restored = new PluginData(persisted)
        assert.equal(restored.theme, 'milthm')
        assert.equal(restored.themePreference, 'milthm')
    } finally {
        themeManager.isCustomTheme = originalIsCustomTheme
        themeManager.isThemeAvailable = originalIsThemeAvailable
    }
})

test('changing theme preference updates both the persisted preference and effective theme', () => {
    const data = new PluginData({ theme: 'default' })
    assert.equal(data.setThemePreference('star'), 'star')
    assert.equal(data.theme, 'star')
    assert.equal(JSON.parse(JSON.stringify(data)).theme, 'star')
})
