/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    LitElement,
    html,
    customElement,
    property,
    CSSResult,
    TemplateResult,
    css,
    PropertyValues,
    state
} from 'lit-element'
import { styleMap } from 'lit-html/directives/style-map'
import { HassEntity } from 'home-assistant-js-websocket'
import {
    HomeAssistant,
    hasConfigOrEntityChanged,
    LovelaceCard
} from 'custom-card-helpers'; // This is a community maintained npm module with common helper functions/types
import { disableBodyScroll, enableBodyScroll } from 'body-scroll-lock'

import type { MySliderCardConfig } from './extras/types'
import { SLIDER_VERSION } from './extras/const'
import { localize } from '../localize/localize'
import { getStyle } from './styles/my-slider.styles'
// import './scripts/deflate.js'
import { deflate } from '../scripts/deflate'
import { percentage, roundPercentage, getClickPosRelToTarget } from '../scripts/helpers'

/* eslint no-console: 0 */
console.info(
    `%c  ---- MY-SLIDER-V2 ---- \n%c  ${localize('common.version')} ${SLIDER_VERSION}    `,
    'color: orange; font-weight: bold; background: black',
    'color: white; font-weight: bold; background: green',
);

// This puts your card into the UI card picker dialog
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
    type: 'my-slider-v2',
    name: 'Slider Card V2',
    description: 'Custom Slider Card V2 for Lovelace.',
});

// TODONE Name your custom element
@customElement('my-slider-v2')
export class MySliderV2 extends LitElement {
    @property() private _config?: MySliderCardConfig
    private entity: HassEntity | undefined
    private colorMode: string = 'brightness'
    private coverMode: string = 'position'
    private sliderId: String = ''
    private sliderEl: HTMLBodyElement | undefined
    private touchInput: Boolean = false
    private disableScroll: Boolean = true
    private allowTapping: Boolean = true
    private actionTaken: Boolean = false
    private vertical: Boolean = false
    private flipped: Boolean = false
    private inverse: Boolean = false
    private showMin: Boolean = false
    private zero: number = 0
    private savedMin: number = 1
    private min: number = 0
    private max: number = 100
    private minThreshold: number = 0
    private maxThreshold: number = 100
    private step: number = 1
    private sliderVal: number = 0
    private sliderValPercent: number = 0.00
    private setSliderValues(val, valPercent): void {
        if (this.inverse) {
            this.sliderVal = this.max - val
            this.sliderValPercent = 100 - valPercent
        }
        else {
            this.sliderVal = val
            this.sliderValPercent = valPercent
        }
    }

    public static getStubConfig(): object {
        return {}
    }

    static get properties() {
        return {
            hass: {},
            config: {},
            active: {}
        }
    }

    @property({ attribute: false }) public hass!: HomeAssistant;
    @state() private config!: MySliderCardConfig;
    public setConfig(config: MySliderCardConfig): void {
        const allowedEntities = [
            'light',
            'input_number',
            'number',
            'media_player',
            'cover',
            'fan',
            'switch',
            'lock'
        ]

        if (!config.entity) {
            throw new Error("You need to define entity")
        }

        if (!allowedEntities.includes(config.entity.split('.')[0])) {
            throw new Error(`Entity has to be one of the following: ${allowedEntities.map(e => ' ' + e)}`)
        }

        this.config = {
            name: 'MySliderV2',
            ...config,
        }
    }

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        if (!this.config) {
            return false
        }

        return hasConfigOrEntityChanged(this, changedProps, false)
    }

    protected render(): TemplateResult | void {
        const initFailed = this.initializeConfig()
        if (initFailed !== null) return initFailed

        const deflatedCardStl = deflate(this._config!.styles?.card) ? deflate(this._config!.styles?.card) : {}
        const deflatedContainerStl = deflate(this._config!.styles?.container) ? deflate(this._config!.styles?.container) : {}
        const deflatedTrackStl = deflate(this._config!.styles?.track) ? deflate(this._config!.styles?.track) : {}
        const deflatedProgressStl = deflate(this._config!.styles?.progress) ? deflate(this._config!.styles?.progress) : {}
        const deflatedThumbStl = deflate(this._config!.styles?.thumb) ? deflate(this._config!.styles?.thumb) : {}
        const deflatedValueStl = deflate(this._config!.styles?.value) ? deflate(this._config!.styles?.value) : {}
        // ---------- Styles ---------- //
        const cardStl = getStyle('card', deflatedCardStl)
        const containerStl = getStyle('container', deflatedContainerStl)
        const trackStl = getStyle('track', deflatedTrackStl)
        const progressStl = getStyle('progress', deflatedProgressStl)
        const thumbStl = getStyle('thumb', deflatedThumbStl)
        const valueStl = getStyle('value', deflatedValueStl)

        if (this.vertical) {
            progressStl.height = this.sliderValPercent.toString() + '%'

            // Setting default styles for vertical if nothing is provided
            cardStl.height = deflatedCardStl.height ? deflatedCardStl.height : '100%'
            cardStl.width = deflatedCardStl.width ? deflatedCardStl.width : '30px'
            progressStl.width = deflatedProgressStl.width ? deflatedProgressStl.width : '100%'
            progressStl.right = deflatedProgressStl.right ? deflatedProgressStl.right : 'auto'
            thumbStl.right = deflatedThumbStl.right ? deflatedThumbStl : 'auto'
            thumbStl.width = deflatedThumbStl.width ? deflatedThumbStl.width : '100%'
            thumbStl.height = deflatedThumbStl.height ? deflatedThumbStl.height : '10px'

            if (valueStl.height && thumbStl.height) {
                valueStl.top = `calc((-${valueStl.height} / 2) + (${thumbStl.height} / 2))`
            } else {
                valueStl.top = "0"
            }

            if (valueStl.width) {
                valueStl.right = `calc(${valueStl.width} - 4px)`
            } else {
                valueStl.right = '-100%'
            }

            if (this.flipped) {
                progressStl.top = deflatedProgressStl.top ? deflatedProgressStl.top : '0'
                thumbStl.bottom = deflatedThumbStl.bottom ? deflatedThumbStl.bottom : '-5px'
            }
            else {
                progressStl.bottom = deflatedProgressStl.bottom ? deflatedProgressStl.bottom : '0'
                thumbStl.top = deflatedThumbStl.top ? deflatedThumbStl.top : '-5px'
            }
        }
        else {
            progressStl.width = this.sliderValPercent.toString() + '%'
            if (this.flipped) {
                progressStl.right = deflatedProgressStl.right ? deflatedProgressStl.right : '0'
                thumbStl.right = deflatedThumbStl.right ? deflatedThumbStl.right : 'auto'
                thumbStl.left = deflatedThumbStl.left ? deflatedThumbStl.left : '-5px'
            }

            if (valueStl.width && thumbStl.width) {
                valueStl.left = `calc((-${valueStl.width} / 2) + (${thumbStl.width} / 2))`
            } else {
                valueStl.left = "0"
            }

            if (valueStl.height) {
                valueStl.top = `calc(-${valueStl.height} - 4px)`
            } else {
                valueStl.top = '-100%'
            }
        }

        valueStl.opacity = '0'

        const setElements = (event) => {
            const sliderMaybe = event.composedPath().find(el => el.classList.contains('my-slider-custom-container'))
            if (!sliderMaybe) {
                this.sliderEl = event.target
            }
            else {
                this.sliderEl = sliderMaybe
            }
        }

        const sliderHandler = (event) => {
            switch (event.type) {
                case 'mousedown':
                    if (this.touchInput) return
                    // console.log('MOUSE DOWN:', event)
                    startInput(event)

                    break

                case 'touchstart':
                    this.touchInput = true
                    // console.log('TOUCH START:', event)
                    startInput(event)
                    break

                case 'mousemove':
                    if (this.touchInput) return
                    // if (this.actionTaken)
                    //     console.log('MOUSE MOVE:', event)

                    moveInput(event)
                    break

                case 'touchmove':
                    // if (this.actionTaken)
                    //     console.log('TOUCH MOVE:', event)

                    moveInput(event)
                    break

                case 'mouseup':
                case 'touchend':
                case 'touchcancel':
                    stopInput(event)
                    break
            }
        }

        const startInput = (event) => {
            if (this.actionTaken) {
                return
            }
            
            setElements(event)
            if (!this.sliderEl) {
                return
            }

            const thumbEl: HTMLElement | null = this.sliderEl.querySelector('.my-slider-custom-thumb')
            const valueEl: HTMLElement | null = this.sliderEl.querySelector('.my-slider-custom-value')
            if (!thumbEl || !valueEl) {
                return
            }

            const thumbRect = thumbEl.getBoundingClientRect()
            const relativeTapPosition = getClickPosRelToTarget(event, thumbEl)
            const outsideTapAreaX = (Math.max(thumbRect.width, 60) - thumbRect.width) / 2
            const outsideTapAreaY = (Math.max(thumbRect.height, 60) - thumbRect.height) / 2

            if (!this.allowTapping &&
                (relativeTapPosition.x < -outsideTapAreaX || relativeTapPosition.x > thumbRect.width + outsideTapAreaX ||
                 relativeTapPosition.y < -outsideTapAreaY || relativeTapPosition.y > thumbRect.height + outsideTapAreaY)
            ) {
                return
            }

            this.actionTaken = true
            valueEl.style.opacity = '1'
            
            this.calcProgress(event)
        }

        const stopInput = (event) => {
            if (!this.actionTaken) {
                return
            }

            if (this.sliderEl) {
                const valueEl: HTMLElement | null = this.sliderEl.querySelector('.my-slider-custom-value')
                if (valueEl) {
                    valueEl.style.opacity = '0'
                }
            }

            this.calcProgress(event)
            
            this.actionTaken = false
            this.touchInput = false
        }

        const moveInput = (event) => {
            if (!this.actionTaken) {
                return
            }

            if (this.disableScroll) {
                event.preventDefault()
            }

            this.calcProgress(event)
        }

        this.createAndCleanupEventListeners(sliderHandler)
        return html`
            <ha-card class="my-slider-custom-card" style="${styleMap(cardStl)}">
                <div class="my-slider-custom-container" id="${this.sliderId}" style="${styleMap(containerStl)}" data-value="${this.sliderVal}" data-progress-percent="${this.sliderValPercent}"
                    @mousedown="${sliderHandler}"
                    @mouseup="${sliderHandler}"
                    @mousemove="${sliderHandler}"
                    @touchstart="${sliderHandler}"
                    @touchend="${sliderHandler}"
                    @touchcancel="${sliderHandler}" 
                    @touchmove="${sliderHandler}"
                >
                    <div class="my-slider-custom-track" style="${styleMap(trackStl)}">
                        <div class="my-slider-custom-progress" style="${styleMap(progressStl)}">
                            <div class="my-slider-custom-thumb" style="${styleMap(thumbStl)}">
                                <div class="my-slider-custom-value" style="${styleMap(valueStl)}">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </ha-card>
        `
    }

    private initializeConfig(): any {
        this.entity = this.hass.states[`${this.config.entity}`]
        try {
            this._config = this._objectEvalTemplate(this.entity, this.config)
        } catch (e) {
            if (e instanceof Error) {
              if (e.stack) console.error(e.stack)
              else console.error(e)
              const errorCard = document.createElement('hui-error-card') as LovelaceCard
              errorCard.setConfig({
                  type: 'error',
                  error: e.toString(),
                  origConfig: this.config,
              })
              return errorCard
            }
            else {
                console.log('Unexpected error evaluating config on init:', e)
            }
        }

        this.sliderId = `slider-${this._config!.entity.replace('.', '-')}`
        this.colorMode = this._config!.colorMode !== undefined ? this._config!.colorMode : 'brightness'
        this.coverMode = this._config!.coverMode !== undefined ? this._config!.coverMode : 'position'
        this.vertical = this._config!.vertical !== undefined ? this._config!.vertical : false
        this.flipped = this._config!.flipped !== undefined ? this._config!.flipped : false
        this.inverse = this._config!.inverse !== undefined ? this._config!.inverse : false
        this.disableScroll = this._config!.disableScroll !== undefined ? this._config!.disableScroll : true
        this.allowTapping = this._config!.allowTapping !== undefined ? this._config!.allowTapping : true
        this.showMin = this._config!.showMin !== undefined ? this._config!.showMin : false
        this.min = this._config!.min ? this._config!.min : 0
        this.max = this._config!.max ? this._config!.max : 100
        this.minThreshold = this._config!.minThreshold ? this._config!.minThreshold : 0
        this.maxThreshold = this._config!.maxThreshold ? this._config!.maxThreshold : 100
        this.step = this._config!.step ? this._config!.step : 1

        let tmpVal = 0
        switch (this._config!.entity.split('.')[0]) {

            case 'light': /* ------------ LIGHT ------------ */
                if (this.colorMode === 'brightness') {
                    if (this.entity.state === 'on') {
                        tmpVal = Math.round(this.entity.attributes.brightness / 2.56)
                        if (!this.showMin) { // Subtracting savedMin to make slider 0 be far left
                            tmpVal = tmpVal - this.min
                        }
                    }
                    else {
                        tmpVal = 0
                    }
                }
                else if (this.colorMode === 'temperature') {
                    if (this.entity.state !== 'on') break
                    this.min = this._config!.min ? this._config!.min : this.entity.attributes.min_mireds
                    this.max = this._config!.max ? this._config!.max : this.entity.attributes.max_mireds
                    tmpVal = parseFloat(this.entity.attributes.color_temp)
                    if (!this.showMin) { // Subtracting savedMin to make slider 0 be far left
                        this.max = this.max - this.min
                        tmpVal = tmpVal - this.min
                    }
                }
                else if (this.colorMode === 'hue' && this.entity.attributes.color_mode === 'hs') {
                    if (this.entity.state !== 'on') break

                    this.min = this._config!.min ? this._config!.min : 0
                    this.max = this._config!.max ? this._config!.max : 360

                    tmpVal = parseFloat(this.entity.attributes.hs_color[0])
                    if (!this.showMin) { // Subtracting savedMin to make slider 0 be far left
                        this.max = this.max - this.min
                        tmpVal = tmpVal - this.min
                    }
                }
                else if (this.colorMode === 'saturation' && this.entity.attributes.color_mode === 'hs') {
                    if (this.entity.state !== 'on') break

                    // let oldVal = parseFloat(entity.attributes.hs_color[0])
                    // const currentSaturation = parseFloat(entity.attributes.hs_color[1])
                    this.min = this._config!.min ? this._config!.min : 0
                    this.max = this._config!.max ? this._config!.max : 100

                    tmpVal = parseFloat(this.entity.attributes.hs_color[1])
                    if (!this.showMin) { // Subtracting savedMin to make slider 0 be far left
                        this.max = this.max - this.min
                        tmpVal = tmpVal - this.min
                    }
                }

                this.setSliderValues(tmpVal, roundPercentage(percentage(tmpVal, this.max)))

                break
            case 'input_number': /* ------------ INPUT_NUMBER ------------ */
            case 'number':
                this.step = this._config!.step ? this._config!.step : this.entity.attributes.step
                this.min = this._config!.min ? this._config!.min : this.entity.attributes.min
                this.max = this._config!.max ? this._config!.max : this.entity.attributes.max
                tmpVal = parseFloat(this.entity.state)
                if (!this.showMin) { // Subtracting savedMin to make slider 0 be far left
                    this.max = this.max - this.min
                    tmpVal = tmpVal - this.min
                }

                this.setSliderValues(tmpVal, roundPercentage(percentage(tmpVal, this.max)))


                break
            case 'media_player': /* ------------ MEDIA_PLAYER ------------ */
                tmpVal = 0
                if (this.entity.attributes.volume_level != undefined) {
                    tmpVal = Number(this.entity.attributes.volume_level * 100)
                }

                if (!this.showMin) { // Subtracting savedMin to make slider 0 be far left
                    this.max = this.max - this.min
                    tmpVal = tmpVal - this.min
                }

                this.setSliderValues(tmpVal, roundPercentage(percentage(tmpVal, this.max)))


                break
            case 'cover': /* ------------ COVER ------------ */
                tmpVal = 0
                if (this.coverMode === 'position') {
                    if (this.entity.attributes.current_position != undefined) {
                        tmpVal = Number(this.entity.attributes.current_position)
                    }
                } else if (this.coverMode === 'tilt') {
                    if (this.entity.attributes.current_tilt_position != undefined) {
                        tmpVal = Number(this.entity.attributes.current_tilt_position)
                    }
                }

                if (!this.showMin) { // Subtracting savedMin to make slider 0 be far left
                    this.max = this.max - this.min
                    tmpVal = tmpVal - this.min
                }


                this.inverse = this._config!.inverse !== undefined ? this._config!.inverse : true
                this.vertical = this._config!.vertical !== undefined ? this._config!.vertical : true
                this.flipped = this._config!.flipped !== undefined ? this._config!.flipped : true

                this.setSliderValues(tmpVal, roundPercentage(percentage(tmpVal, this.max)))


                break
            case 'fan': /* ------------ FAN ------------ */
                tmpVal = 0
                if (this.entity.attributes.percentage != undefined) {
                    tmpVal = Number(this.entity.attributes.percentage)
                }

                if (!this.showMin) { // Subtracting savedMin to make slider 0 be far left (sometimes needed, sometimes not. I dont have a fan to test this. Sorry)
                    this.max = this.max - this.min
                    tmpVal = tmpVal - this.min
                }

                this.setSliderValues(tmpVal, roundPercentage(percentage(tmpVal, this.max)))


                break
            case 'switch': /* ------------ SWITCH ------------ */
                this.minThreshold = this._config!.minThreshold ? this._config!.minThreshold : 15
                this.maxThreshold = this._config!.maxThreshold ? this._config!.maxThreshold : 75
                tmpVal = Number(Math.max(this.zero, this.minThreshold))
                this.setSliderValues(tmpVal, tmpVal)


                break
            case 'lock': /* ------------ LOCK ------------ */
                this.minThreshold = this._config!.minThreshold ? this._config!.minThreshold : 15
                this.maxThreshold = this._config!.maxThreshold ? this._config!.maxThreshold : 75
                tmpVal = Number(Math.max(this.zero, this.minThreshold))// Set slider to larger of 2 minimums
                this.setSliderValues(tmpVal,tmpVal)

                break
            default:
                console.log('No Entity type initiated... (' + this._config!.entity.split('.')[0] + ')')
                break
        }

        return null // Succes in this case
    }

    private calcProgress(event) {
        if (this.sliderEl == undefined || this.sliderEl === null) return
        const clickPos = getClickPosRelToTarget(event, this.sliderEl)
        const sliderWidth = this.sliderEl.offsetWidth
        const sliderHeight = this.sliderEl.offsetHeight
        // Calculate what the percentage is of the clickPos.x between 0 and sliderWidth / clickPos.y between 0 and sliderHeight
        const clickPercent = this.vertical ? roundPercentage(clickPos.y/sliderHeight * 100) : roundPercentage(clickPos.x/sliderWidth * 100)
        const newValue = clickPercent / 100 * (this.max - 0)
        const flippedValue = this.max - newValue
        let val = this.flipped ? Math.round(flippedValue) : Math.round(newValue)
        // Set val to be either min, max, zero or value
        val = val < this.min && this.showMin ? this.min : val > this.max ? this.max : val < this.zero ? this.zero : val
        this.setProgress(this.sliderEl, Math.round(val), event.type)
    }

    private setProgress(slider, val, action) {
        const progressEl = slider.querySelector('.my-slider-custom-progress')
        const valueEl = slider.querySelector('.my-slider-custom-value')
        const valuePercentage = roundPercentage(percentage(val, this.max))
        if (this.vertical) {
            // Set progessHeight to match value
            progressEl.style.height = valuePercentage.toString() + '%'
        }
        else {
            // Set progessWidth to match value
            progressEl.style.width = valuePercentage.toString() + '%'
        }

        let displayVal = val
        if (!this.showMin) {
            displayVal = displayVal + this.min
        }
        if (this.inverse) {
            displayVal = this.max - displayVal
        }
        valueEl.innerText = String(displayVal)

        // Check if value has changed
        if (this.sliderVal !== val) {
            // Check if we should update entity on mousemove or mouseup
            if (this._config!.intermediate && (action === 'mousemove' || action === 'touchmove')) {
                this.setValue(val, valuePercentage)
            }
            else if (!this._config!.intermediate && (action === 'mouseup' || action === 'touchend' || action === 'touchcancel')) {
                this.setValue(val, valuePercentage)
            }
        }
    }

    private setValue(val, valPercent) {
        if (!this.entity) return
        this.setSliderValues(val, valPercent)
        if (!this.showMin) {
            val = val + this.min  // Adding saved min to make up for minimum not being 0
        }
        if (this.inverse) {
            val = this.max - val
            valPercent = 100 - valPercent
        }
        if (!this.actionTaken) return // We do not want to set any values based on pure movement of slider. Only set it on user action.
        switch (this._config!.entity.split('.')[0]) {
            case 'light':
                if (this.colorMode === 'brightness') {
                    this._setBrightness(this.entity, val)
                }
                else if (this.colorMode === 'temperature') {
                    this._setColorTemp(this.entity, val)
                }
                else if (this.colorMode === 'hue') {
                    this._setHue(this.entity, val)
                }
                else if (this.colorMode === 'saturation') {
                    this._setSaturation(this.entity, val)
                }
                break
            case 'input_number':
            case 'number':
                this._setInputNumber(this.entity, val)
                break
            case 'media_player':
                this._setMediaVolume(this.entity, val)
                break
            case 'cover':
                if (this.coverMode === 'position') {
                    this._setCover(this.entity, val)
                } else if (this.coverMode === 'tilt') {
                    this._setCoverTilt(this.entity, val)
                }
                break
            case 'fan':
                this._setFan(this.entity, val)
                break
            case 'lock':
                this._setLock(this.entity, val)
                break
            case 'switch':
                this._setSwitch(this.entity, val)
                break
            default:
                console.log('Default')
                break
        }

    }

    private _setBrightness(entity, value): void {
        if (entity.state === 'off' || (Math.abs((value - Math.round(entity.attributes.brightness / 2.56))) > this.step)) {
            this.hass.callService("light", "turn_on", {
                entity_id: entity.entity_id,
                brightness: value * 2.56
            })
        }
    }
	private _setColorTemp(entity, value): void {
        let oldVal = parseFloat(entity.attributes.color_temp)
        // // Do not ask me why this is not needed here. In my mind it should be required, but it's off by that much when subtracting. (Should not code with corona)
        // if (!this.showMin) {
        //     oldVal = oldVal - this.min // Subtracting savedMin to make slider 0 be far left
        // }
        console.debug('Math.abs((value - oldVal)) > this.step :', Math.abs((value - oldVal)) > this.step)
        console.debug('value:', value)
        console.debug('oldVal:', oldVal)
        console.debug('this.step:', this.step)
        if (entity.state === 'off' || Math.abs((value - oldVal)) > this.step) {
            console.debug('DID MEET THE CRITERIA!')
        }
        else {
            console.debug('DID NOT MEET THE CRITERIA! BECAUSE ITS EITHER ON ALREADY OR THE STEP WAS BELOW THRESHOLD! SUPPOSEDLY')
        }

        this.hass.callService("light", "turn_on", {
            entity_id: entity.entity_id,
            color_temp: value
        })
	}
    private _setHue(entity, value): void {
        let oldVal = 0
        let currentSaturation = 0
        if (entity.attributes.hs_color) {
            oldVal = parseFloat(entity.attributes.hs_color[0])
            currentSaturation = parseFloat(entity.attributes.hs_color[1])
        }
        if (entity.state === 'off' || Math.abs((value - oldVal)) > this.step) {
            this.hass.callService("light", "turn_on", {
                entity_id: entity.entity_id,
                hs_color: [value, currentSaturation]
            })
        }
    }
    private _setSaturation(entity, value): void {
        let oldVal = 0
        let currentHue = 0
        if (entity.attributes.hs_color) {
            oldVal = parseFloat(entity.attributes.hs_color[1])
            currentHue = parseFloat(entity.attributes.hs_color[0])
        }
        if (entity.state === 'off' || Math.abs((value - oldVal)) > this.step) {
            this.hass.callService("light", "turn_on", {
                entity_id: entity.entity_id,
                hs_color: [currentHue, value]
            })
        }
    }

	private _setInputNumber(entity, value): void {
        let oldVal = parseFloat(entity.state)
        if (!this.showMin) {
            oldVal = oldVal - this.min // Subtracting savedMin to make slider 0 be far left
        }

        if (Math.abs((value - oldVal)) > this.step) {
            this.hass.callService(entity.entity_id.split('.')[0], "set_value", { // either "input_number" or "number"
                entity_id: entity.entity_id,
                value: value
            })
        }
	}
	private _setMediaVolume(entity, value): void {
        let oldVal = Number(this.entity!.attributes.volume_level * 100)
        if (!this.showMin) { // Subtracting savedMin to make slider 0 be far left
            oldVal = oldVal - this.min
        }

        // TODO: This will be false if entity is off. Set volume even when off/not playing/idle? (whatever states to check for?)
        if (Math.abs((value - oldVal)) > this.step) {
            this.hass.callService("media_player", "volume_set", {
                entity_id: entity.entity_id,
                volume_level: value / 100
            })
        }
	}
	private _setCover(entity, value): void {
		this.hass.callService("cover", "set_cover_position", {
			entity_id: entity.entity_id,
			position: value
		});
	}

    private _setCoverTilt(entity, value): void {
        this.hass.callService("cover", "set_cover_tilt_position", {
            entity_id: entity.entity_id,
            tilt_position: value
        });
    }

	private _setFan(entity, value): void {
		this.hass.callService("fan", "set_percentage", {
			entity_id: entity.entity_id,
			percentage: value
		})
	}

	private _setSwitch(entity, value): void {
		var threshold = Math.min(this.max, this.maxThreshold) //pick lesser of the two
		if (Number(threshold) <= value) {
			this.hass.callService('homeassistant', 'toggle', {
				entity_id: entity.entity_id
			})
		}

        const val = Number(Math.max(this.zero, this.minThreshold))
        const valPercent = roundPercentage(percentage(val, this.max))
        this.setSliderValues(val, valPercent) // Set slider to larger of 2 minimums
        const progressEl: HTMLElement | null = this.sliderEl!.querySelector('.my-slider-custom-progress')
        progressEl!.style.transition = 'width 0.2s ease 0s' // Make it sprong back nicely
        progressEl!.style.width = valPercent.toString() + '%'
        setTimeout(() => { // Remove transition when done
            progressEl!.style.transition = 'initial'
        }, 200)
	}
	private _setLock(entity, value): void {
		var threshold = Math.min(this.max, this.maxThreshold) //pick lesser of the two
		if (Number(threshold) <= value) {
			var newLockState = entity.state === "locked" ? 'unlock' : 'lock'
			this.hass.callService("lock", newLockState, {
				entity_id: entity.entity_id
			})
		}

        const val = Number(Math.max(this.zero, this.minThreshold))
        const valPercent = roundPercentage(percentage(val, this.max))
        this.setSliderValues(val, valPercent) // Set slider to larger of 2 minimums
        const progressEl: HTMLElement | null = this.sliderEl!.querySelector('.my-slider-custom-progress')
        progressEl!.style.transition = 'width 0.2s ease 0s' // Make it sprong back nicely
        progressEl!.style.width = valPercent.toString() + '%'
        setTimeout(() => { // Remove transition when done
            progressEl!.style.transition = 'initial'
        }, 200)
	}

    private createAndCleanupEventListeners(func): void {
        document.removeEventListener("mouseup", func)
        document.removeEventListener("touchend", func)
        document.removeEventListener("touchcancel", func)
        document.addEventListener("mouseup", func)
        document.addEventListener("touchend", func)
        document.addEventListener("touchcancel", func)
        document.addEventListener("mousemove", func)
    }



    // // Not used on slider since we handle the action ourselves
    // private _evalActions(config: MySliderCardConfig, action: string): MySliderCardConfig {
    //     // const configDuplicate = copy(config);
    //     const configDuplicate = JSON.parse(JSON.stringify(config));
    //     /* eslint no-param-reassign: 0 */
    //     const __evalObject = (configEval: any): any => {
    //         if (!configEval) {
    //             return configEval;
    //         }
    //         Object.keys(configEval).forEach((key) => {
    //             if (typeof configEval[key] === 'object') {
    //                 configEval[key] = __evalObject(configEval[key]);
    //             } else {
    //                 configEval[key] = this._getTemplateOrValue(this.entity, configEval[key]);
    //             }
    //         });
    //         return configEval;
    //     };
    //     configDuplicate[action] = __evalObject(configDuplicate[action]);
    //     if (!configDuplicate[action].confirmation && configDuplicate.confirmation) {
    //         configDuplicate[action].confirmation = __evalObject(configDuplicate.confirmation);
    //     }
    //     return configDuplicate;
    // }

    private _objectEvalTemplate(state: HassEntity | undefined, obj: any | undefined): any {
        const objClone = JSON.parse(JSON.stringify(obj))
        return this._getTemplateOrValue(state, objClone);
    }

    private _getTemplateOrValue(state: HassEntity | undefined, value: any | undefined): any | undefined {
        if (['number', 'boolean'].includes(typeof value)) return value;
        if (!value) return value;
        if (typeof value === 'object') {
            Object.keys(value).forEach((key) => {
                value[key] = this._getTemplateOrValue(state, value[key]);
            });
            return value;
        }
        const trimmed = value.trim();
        if (trimmed.substring(0, 3) === '[[[' && trimmed.slice(-3) === ']]]') {
            const tmp = this._evalTemplate(state, trimmed.slice(3, -3))
            return tmp
        } else {
            return value
        }
    }

    private _evalTemplate(state: HassEntity | undefined, func: any): any {
        /* eslint no-new-func: 0 */
        try {
            return new Function('states', 'entity', 'user', 'hass', 'html', `'use strict'; ${func}`).call(
                this,
                this.hass!.states,
                state,
                this.hass!.user,
                this.hass,
                html,
            );
        } catch (e) {

            if (e instanceof Error) {
                const funcTrimmed = func.length <= 100 ? func.trim() : `${func.trim().substring(0, 98)}...`;
                e.message = `${e.name}: ${e.message} in '${funcTrimmed}'`;
                e.name = 'MyCardJSTemplateError';
                throw e;
              }
              else {
                  console.log('Unexpected error (_evalTemplate)', e);
              }
        }
    }

    // https://lit-element.polymer-project.org/guide/styles
    static get styles(): CSSResult {
        return css`
		`;
    }
}


/*
type: custom:my-slider-v2
entity: light.sofa_spots
colorMode: 'brightness' (Can be 'brightness', 'temperature', 'hue', 'saturation')
coverMode: 'position' (Accept: 'position', 'tilt')
// warmth: false (Will be removed now!)
vertical: false (This will set the vertical to be vertical and handled from bottom to top. Automatically used on covers)
flipped: false (This will just flip the slider to go from right to left or top to bottom. Automatically used on covers)
inverse: false (Will inverse how far the slider has progressed compared to value. so if brightness is 75%, then it will only be 25% progressed. This is useful for cover, where it is automatically used.)
min: 0
max: 100
intermediate: false
disableScroll: true (Disable scrolling on touch devices when starting the touchmove from within the slider)
allowTapping: true (Tap anywhere on the slider to set that value. If false you can only drag from thumb.)
showMin: false
minThreshold: 15 (Only used for determining how much progress should be shown on a switch or lock)
maxThreshold: 75 (Only used to determine how far users have to slide to activate toggle commands for switch and lock)
styles:
  card:
    - height: 50px
  container:
    - background: red
  track:
    - background: blue
  thumb:
    - background: yellow
*/

/*
TODO:
- Create colorMode config key. It should accept: (https://developers.home-assistant.io/docs/core/entity/light/)
    'brightness', 'temperature', 'hue' 'saturation', 'red', 'green', 'blue', 'white', 'x_color', 'y_color' and 'toggle'
    Future maybe: 'hs', 'rgb', 'rgbw', 'xy_color'. This will be where there will automatically be multiple sliders with same config in the same card
    - brightness: Adjust brightness of light (IMPLEMENTED)
    - temperature: Adjust temperature/warmth of light (IMPLEMENTED)
    - hue: Adjust Hue value in hs_color (0-360)
    - saturation: Adjust Saturation in hs_color (0-100)


    - hs: Adjust Hue & Saturation of light
    - rgb: Adjust Red, Green & Blue colors on light
    - rgbw: Adjust Red, Green, Blue & white colors on light
    - xy_color: Adjust lights colors by adjust xy_color attribute
TODONE:
*/
