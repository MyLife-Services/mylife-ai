/* imports */
import {
    addMessage,
    assignElements,
    clearSystemChat,
    escapeHtml,
    getInputValue,
    getSystemChat,
    globals,
    hide,
    replaceElement,
    sceneTransition as memberSceneTransition,
    show,
    stageTransition,
    toggleMemberInput,
    waitForUserAction,
} from './members.mjs'
/* constants */
const backstage = document.getElementById('experience-backstage'),
    botbar = document.getElementById('bot-bar'),
    breadcrumb = document.getElementById('experience-breadcrumb'),
    cast = document.getElementById('experience-cast'),
    closeButton = document.getElementById('experience-close'),
    description = document.getElementById('experience-description'),
    footer = document.getElementById('experience-footer'),
    mainContent = document.getElementById('main-content'),
    mainstage = document.getElementById('experience-mainstage'),
    manifest = document.getElementById('experience-manifest'),
    modal = document.getElementById('experience-modal'),
    moderator = document.getElementById('experience-moderator'),
    moderatorDialog = document.getElementById('experience-moderator-dialog'),
    moderatorIcon = document.getElementById('experience-moderator-icon'),
    moderatorProps = document.getElementById('experience-moderator-props'),
    moderatorSubmit = document.getElementById('experience-submit'),
    moderatorWaiting = document.getElementById('experience-input-waiting'),
    experienceNavigation = document.getElementById('experience-navigation'),
    sceneContinue = document.getElementById('experience-continue'),
    sceneContinueText = document.getElementById('experience-continue-text'),
    sceneStage = document.getElementById('experience-scenestage'),
    screen = document.getElementById('experience-modal'),
    skip = document.getElementById('experience-skip'),
    stage = document.getElementById('experience-stage'),
    start = document.getElementById('experience-start'),
    startButton = document.getElementById('experience-start-button'),
    startSpinner = document.getElementById('experience-start-spinner'),
    title = document.getElementById('experience-title'),
    transport = document.getElementById('experience-transport')
const mDefaultAnimationClasses = {
    chat: 'fade-in',
    interface: 'flip',
    full: 'slide-in',
}
const mExperiences = [] /* initial container for all experience requests, personal to system scope */
/* variables */
let mBackdropDefault = 'full',
    mEvent,
    mExperience,
    mMainstagePrepared = false,
    mModerator,
    mWelcome = true
let mBackdrop=mBackdropDefault // enum: [chat, interface, full]; default: full
let inputElement = document.getElementById(`experience-input`) /* unique as is swapped out */
/* event listeners */
document.addEventListener('DOMContentLoaded', async event=>{
    mExperiences.push(...await mGetExperiences()) // stock all experiences internally
    /* document listeners for experience launch */
    window.addEventListener('launchExperience', async event=>{
        const { detail: experienceId } = event
        if(!globals.isGuid(experienceId))
            throw new Error('mInitializePageListeners::launchExperience::Error()::`detail` is required')
        mExperience = mExperiences.find(experience=>experience.id===experienceId)
        if(!mExperience)
            throw new Error('mInitializePageListeners()::launchExperience::no experience found in `mExperiences`')
        stageTransition(experienceId, false)
    })
    console.log('experience.mjs::DOMContentLoaded()::mExperiences', mExperiences)
})
/* public functions */
/**
 * End experience on server and onscreen.
 * @public
 * @async
 * @returns {Promise<void>} - The return is its own success, having cleared all active experience data.
 */
async function experienceEnd(){
    if(!mExperience || !mExperience?.id?.length || !await globals.datamanager.experienceEnd(mExperience.id))
        return
    mExperience = null
    /* remove listeners */
    closeButton.removeEventListener('click', experienceEnd)
    startButton.removeEventListener('click', experiencePlay)
    /* end experience onscreen */
    sceneStage.innerHTML = '' // clear full-screen character-lanes
    clearSystemChat() // clear member chat lanes
    stageTransition(null, true) // request force-clear of member experience
}
/**
 * Play experience onscreen, mutates `mExperience` object.
 * @public
 * @async
 * @requires mExperience
 * @param {Object} memberInput - Member Input in form of object.
 * @returns {Promise<void>} - The return is its own success.
 */
async function experiencePlay(memberInput){
    if(!mExperience)
        throw new Error("Experience not found!")
    const { events: experienceEvents, } = mExperience
    let events
    if(!mWelcome){
        mToggleInputLane(false)
        try{
            events = await mEvents(memberInput)
        } catch(error){/* suppress here to clean backdrop, error will fire below */}
        mToggleInputLane(true, true)
    } else {
        events = experienceEvents ?? await mEvents()
        mWelcome = false
    }
    if(!events?.length)
        throw new Error("No events found")
    /* prepare events */
    mExperience.events = experienceEvents
        .map(event=>{
            const { id, }  = event
            return events.find(_event => _event.id === id)
                ?? event
        })
    const newEvents = events.filter(incEvent=>!mExperience.events.some(event => event.id === incEvent.id))
    mExperience.events = [...mExperience.events, ...newEvents]
    /* prepare mainstage */
    if(!mMainstagePrepared)
        mSceneTransition()
    /* prepare animations */
    const animationSequence = []
    events
        .sort((eA, eB)=>eA.order - eB.order)
        .forEach(event=>{
            mEvent = event
            animationSequence.push(
                ...mEventStage(),
                ...mEventCharacter(),
                ...mEventDialog(),
                ...mEventInput()
            )
        })
    /* prepare stage */
    // @todo - remove and incorporate at other transitions
    switch(mBackdrop){
        case 'interface':
            break
        case 'chat': // chat uses a single member chat container
            break
        case 'full':
        default:
            show(stage)
            break
    }
    /* play experience */
    if(!await mAnimateEvents(animationSequence))
        throw new Error("Animation sequence failed!")
    mExperience.currentScene = mExperience.events?.[mExperience.events.length-1]?.sceneId
        ?? location.sceneId
}
/**
 * Retrieve full or scoped list of experiences from server.
 * @todo - more robust logic underpinning selection of experiences, currently only system-controlled exist.
 * @requires mExperiences
 * @returns {Experience[]} - The return is an array of Experience objects.
 */
function experiences(scope){
    return mExperiences
}
/**
 * Skips a skippable scene in Experience, and triggers the next scene, which would be returned to member. Stages `mBackdrop` in the instance of a complete backdrop scene change.
 * @public
 * @param {Guid} sceneId - The scene id to skip _to_.
 * @returns {void}
 */
function experienceSkip(sceneId){
    const { location, navigation, skippable, } = mExperience
    if(!skippable)
        throw new Error("Experience not skippable!")
    sceneId = sceneId ?? location?.sceneId
    const scene = navigation.find(nav=>nav.id === sceneId)
    if(!scene)
        throw new Error("Scene not found!")
}
/**
 * Start experience onscreen, displaying welcome ande loading remaining data.
 * @public
 * @param {Guid} experienceId - The Experience id
 * @returns {Promise<void>}
 */
async function experienceStart(experienceId){
    if(!globals.isGuid(experienceId))
        throw new Error('experienceStart::Error()::valid `experienceId` is required')
    mExperience = mExperiences.find(experience=>experience.id===experienceId)
    if(!mExperience)
        throw new Error('experienceStart::Error()::no experience found in `mExperiences` to match `experienceId`: ' + experienceId)
    /* present stage */
    mStageWelcome()
    const { description, events, id, name, purpose, title, skippable=false } = mExperience
    if(!events?.length)
        mExperience.events = await mEvents()
    /* experience manifest */
    const manifest = await mManifest(id)
    if(!manifest)
        throw new Error("Experience not found")
    if(!Array.isArray(manifest.cast)) // cast required, navigation not required
        throw new Error("Experience cast not found")
    mExperience = { ...mExperience, ...manifest }
    /* welcome complete, display experience-start-button */
    mUpdateStartButton()
}
/**
 * On-click assignment that primes next experiencePlay() to pull from server.
 * @public
 * @returns {void}
 */
function submitInput(event){
    const { inputVariableName, variable, } = mEvent.input
    const value = mBackdrop==='full'
        ? inputElement.value.trim()
        : getInputValue()
    if(value?.length){
        const memberInput = { [inputVariableName ?? variable ?? 'input']: value }
        experiencePlay(memberInput)
            .catch(error=>console.log('submitInput::experiencePlay independent fire ERROR', error.message, memberInput))
    }
}
/* private functions */
/**
 * Adds or Moves a character lane to a specific chat/dialog div
 * @param {HTMLDivElement} dialogDiv - The chat div to append the character lane to.
 * @param {object} character - The character object.
 * @param {boolean} clearDialog - Whether to clear any existing dialog.
 */
function mAddCharacterLane(dialogDiv, character, clearDialog=false){
    const { id: characterId, } = character
    const characterLane = document.getElementById(`char-lane-${characterId}`)
        ?? mCreateCharacterLane(character)
    if(!characterLane)
        throw new Error(`Character lane not found and unable to be created! ${characterId}`)
    hide(characterLane)
    dialogDiv.appendChild(characterLane) /* appendChild will **move** the element */
    if(clearDialog){
        /* remove previous char-lane dialog elements */
        const characterDialog = document.getElementById(`char-dialog-${characterId}`)
        if(characterDialog){
            while(characterDialog.firstChild){
                characterDialog.removeChild(characterDialog.firstChild)
            }
        }
    }
}
/**
 * Animate an element based on the animation event object.
 * @todo - remove requirement for `animationend` specifically, to allow for non animation-based events to have callbacks.
 * @private
 * @param {HTMLElement} element - The element to animate.
 * @param {Object} animationEvent - The animation event data object.
 * @returns {Promise} - The return is the promise that requires resolution in order to fire.
 */
function mAnimateElement(element, animationEvent) {
    return new Promise((resolve, reject) => {
        const { action, animation, dismissable, elementId, halt, moderatorInputElement, moderatorInputType, type, } = animationEvent
        if(!element)
            return reject(new Error(`Element not found: ${animationEvent.elementId}`))
        if(moderatorInputElement){
            inputElement = replaceElement(
                moderatorInputElement,
                moderatorInputType,
                false,
                'input',
                function(event){
                    /* show submit button */
                    event.target.value.trim()
                        ? show(moderatorSubmit)
                        : hide(moderatorSubmit)
                },
            )
        }
        const { animationClass, animationDelay, animationDirection, animationDuration, animationIterationCount } = animation ?? { animationClass: 'animate' }
        element.classList.add(animationClass)
        element.style.animationFillMode = 'forwards'; // Ensure final state is kept
        if(animationDelay)
            element.style.animationDelay = `${animationDelay}s`
        if(animationDirection)
            element.style.animationDirection = animationDirection
        if(animationDuration)
            element.style.animationDuration = `${animationDuration}s`
        if(animationIterationCount)
            element.style.animationIterationCount = animationIterationCount
        const handleAnimationEnd = ()=>{
            element.removeEventListener('animationend', handleAnimationEnd)
            resolve()
        }
        element.addEventListener('animationend', handleAnimationEnd)
        if(dismissable){
            const fastForwardAnimation = () => { // Skip to the end of the animation
                element.removeEventListener('animationend', handleAnimationEnd)
                element.classList.remove(animationClass)
                element.classList.add(`${animationClass}-final`)
                resolve()
            }
            // Add event listeners for dismissible actions
            document.addEventListener('click', fastForwardAnimation, { once: true })
            document.addEventListener('keydown', event=>{
                const { code } = event
                if(['space', 'escape', 'esc', 'enter'].includes(code))
                    fastForwardAnimation()
            }, { once: true })
        }
        show(element)
    })
}
/**
 * Animate a sequence of elements based on the incoming array of animation instructions.
 * @param {Object[]} animationSequence - Array of animation events to be played.
 * @returns {Promise<boolean>} - Success or failure of the animation sequence.
 */
async function mAnimateEvents(animationSequence){
    for(const animationEvent of animationSequence){
        const { action, dismissable, elementId, halt, sceneId, type, } = animationEvent
        /* special case: end-scene/act stage animation */
        if(action==='end'){
            await waitForUserAction()
            if(type==='experience'){ /* close show */
                experienceEnd()
                return true
            } else { /* scene */
                mMainstagePrepared = false // @todo - check for backdrop differences here
                experiencePlay()
                return true
            }
        }
        const element = document.getElementById(elementId)
        if(!element){
            continue
        }
        try {
            if( // skip if already shown or hidden, move variants or other animations, may have more than one
                    animationEvent.action==='appear' && element.classList.contains('show')
                ||  animationEvent.action==='disappear' && !element.classList.contains('show')
            )
                continue
            if(
                    ['interface', 'chat'].includes(mBackdrop)
                &&  type==='character'
                &&  action==='appear'
            ){
                // there can only be one showing at a time, so hide all others
                // select all character lanes that are not hidden
                const characterLanes = document.querySelectorAll('.char-lane:not(.hide)')
                characterLanes.forEach(lane=>{
                    if(lane.id!==elementId)
                        hide(lane)
                })
            }
            if(element.id==='experience-continue'){
                throw new Error('experiencePlay::animationEvent::continue')
            }
            await mAnimateElement(element, animationEvent)
            if(halt && !dismissable){
                await waitForUserAction() // This function would also return a Promise
            }
        } catch(error) {
            console.error('experiencePlay::animation error:', error)
            return false
        }
    }
    return true
}
/**
 * Assigns icon image for Character/Avatar/Moderator.
 * @todo - add click event listener to icon
 * @todo - Character type implementation
 * @private
 * @param {string} character - The character object.
 * @param {HTMLDivElement} element - The HTML element to assign icon to.
 * @returns {void}
 */
function mAssignIcon(character, element=document.getElementById(`experience-moderator-icon`)){
    if(!element)
        throw new Error(`Element not found!`)
    const { bot_id, icon, id: characterId, role, type, url, } = character
    const existingImage = element.querySelector('img')
    const iconId = `icon-image-${characterId}`
    if(existingImage && existingImage.id===iconId)
        return
    if(existingImage)
        element.removeChild(existingImage)
    // Create a new image and set its properties
    const newImage = document.createElement('img')
    let errorTriggered = false
    newImage.onerror = err=>{
        if (!errorTriggered) {
            newImage.src = `../png/experience-icons/system/icon.png`
            errorTriggered = true
        }
    }
    newImage.alt = `Icon for avatar (or moderator), requesting: ${icon}`
    newImage.id = iconId
    newImage.src = mImageSource(icon, type)
    newImage.title = `Avatar Icon`
    return newImage
}
/**
 * Create a dialog box for event and assign to character.
 * @private
 * @returns 
 */
function mCreateCharacterDialog(){
    const dialogDiv = document.createElement('div')
    dialogDiv.id = `char-dialog-${mEvent.id}`
    dialogDiv.name = `dialog-${mEvent.id}`
    // set random type (max 3)
    const dialogType = Math.floor(Math.random() * 3) + 1
    dialogDiv.innerHTML = `<p>${ mEvent.dialog.dialog }</p>`
    dialogDiv.classList.add('char-dialog-box')
    dialogDiv.classList.add(`dialog-type-${dialogType}`)
    return dialogDiv
}
/**
 * Create a lane for a character. Note: might not even in the end need background to be delivered from server, icon, role, all of this character data can be modified EVENT BY EVENT in order for thrillers, etc. in other words, cast data updates as the play goes on, should event data contain it. Love it!
 * @todo - props as per stub below.
 * @stub - props are clickables related to an character - essentially can be anywhere from nonsentient -> intelligenced by bot
 * @private
 * @param {Object} character - The character object.
 * @property {Guid} bot_id - The bot id from Cosmos, _not_ LLM.
 * @property {string} icon - The character's icon.
 * @property {Guid} id - The character's id in cast.
 * @property {string} role - The character's role.
 * @property {string} type - The character's type.
 * @returns {HTMLDivElement} - The character lane div to be attached where it must.
 */
function mCreateCharacterLane(character){
    const { bot_id: actorBotId, id: characterId, role, type, } = character
    let { icon, url, } = character
    const characterDiv = document.createElement('div')
    characterDiv.id = `char-lane-${characterId}`
    characterDiv.name = `${role}-${characterId}`
    if(url?.length){
        if(!url.includes('http://')){
            const imageType = url.includes('.')
                ? url.split('.').pop()
                : 'png'
            url = url.includes('.')
                ? url
                : `${url}.${imageType}`
            url = `../${imageType}/experience-art/` + url
        }
        // any below can be overidden by event
        characterDiv.style.backgroundImage = `url(${url})`
        characterDiv.style.backgroundSize = '100% auto'
        characterDiv.style.backgroundRepeat = 'space'
        characterDiv.style.backgroundPosition = 'right'
    }
    characterDiv.classList.add('char-lane')
    const characterIconDiv = document.createElement('div'),
        characterIconImageDiv = document.createElement('div'),
        characterIconTextDiv = document.createElement('div')
    characterIconDiv.id = `char-icon-${characterId}`
    characterIconDiv.name = `char-icon-${characterId}`
    characterIconDiv.classList.add('char-icon')
    characterIconImageDiv.id = `icon-image-${characterId}`
    characterIconImageDiv.name = `icon-image-${characterId}`
    characterIconImageDiv.classList.add('char-icon-image')
    characterIconTextDiv.id = `icon-text-${characterId}`
    characterIconTextDiv.name = `icon-text-${characterId}`
    characterIconTextDiv.classList.add('char-icon-text')
    /* assign image and text */
    const newImage = mAssignIcon(character, characterIconImageDiv)
    characterIconImageDiv.appendChild(newImage)
    characterIconTextDiv.textContent = role
    characterIconDiv.appendChild(characterIconImageDiv)
    characterIconDiv.appendChild(characterIconTextDiv)
    characterDiv.appendChild(characterIconDiv)
    let characterDialogDiv = document.createElement('div')
    characterDialogDiv.id = `char-dialog-${characterId}`
    characterDialogDiv.name = `dialog-${characterId}`
    characterDialogDiv.classList.add('char-dialog')
    characterDiv.appendChild(characterDialogDiv)
/* props
    @stub
    let characterPropsDiv = document.createElement('div')
    characterPropsDiv.id = `char-props-${characterId}`
    characterPropsDiv.classList.add('char-props')
    characterDiv.appendChild(characterPropsDiv)
*/
    return characterDiv
}
/**
 * Creates and prepends a moderator dialog to help elicit member input.
 * @todo - incorporate a `.prop` function (answering machine?) that allows for auto-answering on member behalf.
 * @private
 * @requires mEvent - Event object.
 * @returns {void}
 */
function mCreateModeratorInputDialog(){
    const { inputId, inputPlaceholder, inputShadow, } = mEvent.input
    /* create spinner */
    const spinnerDiv = document.createElement('div')
    spinnerDiv.id = `spinner-${inputId}`
    spinnerDiv.classList.add('spinner')
    /* create input */
    const inputPromptDiv = document.createElement('div')
    inputPromptDiv.id = `prompt-${inputId}`
    inputPromptDiv.classList.add('char-dialog-box', 'dialog-type-moderator')
    inputPromptDiv.textContent = inputShadow ?? inputPlaceholder ?? `Type in your response below.`
    inputPromptDiv.appendChild(spinnerDiv)
    /* append */
    moderatorDialog.prepend(inputPromptDiv)
}
/**
 * Reads character data for an event and prepares animation sequence.
 * @private
 * @requires mEvent - The current event object.
 * @returns {Object[]} - Array of animation objects.
 */
function mEventCharacter(){
    const { character: characterData, } = mEvent
    const animationSequence = []
    if(characterData){
        const { animation, animationDirection, animationDelay, animationDuration, animationIterationCount, characterId, name, prompt, role, sfx, stageDirection, type, } = characterData
        const character = mExperience.cast.find(character=>character.id === characterId)
        if(!character)
            throw new Error(`Character not found in cast! ${characterId}`)
        /* update `name` and `role` */
        if(role){
            character.role = role
            document.getElementById(`icon-text-${characterId}`).textContent = role
        }
        if(name)
            character.name = name
        /* animate character */
        const characterLane = document.getElementById(`char-lane-${characterId}`)
        if(!characterLane)
            throw new Error(`Character lane not found! ${characterId}`)
        const animationDetails = {
            animationClass: animation ?? mDefaultAnimationClasses[mBackdrop] ?? 'fade-in',
            animationDelay: animationDelay ?? 0.2,
            animationDirection: animationDirection ?? 'forwards',
            animationDuration: animationDuration ?? 1,
            animationIterationCount: animationIterationCount ?? 1,
        }
        /* execute stage Direction */
        switch(stageDirection){
            case 'action':
            case 'move':
                throw new Error(`Stage direction not implemented: ${stageDirection}`) // @stub - add dynamic css stage direction
            case 'disappear':
                hide(characterLane)
                break
            case 'appear':
            default:
                // push appearance/animation of character lane
                animationSequence.push({
                    action: 'appear',
                    // class: '', /* @stub - add dynamic css stage direction */
                    animation: animationDetails,
                    dismissable: false, /* click will dismiss animation */
                    elementId: `char-lane-${characterId}`,
                    halt: false, /* requires next in animationSequence to await for this completion, default=true */
                    type: 'character',
                })
                break
        }
        /* character sfx (and ultimately a/v+?) */
        if(sfx?.length){
            // @stub - add special effects to icon
            // @todo - push char-icon animation (sfx)
            // @todo - push char-text animation
        }
    }
    return animationSequence
}
/**
 * Reads dialog data for an event and prepares animation sequence.
 * @private
 * @requires mEvent - The current event object.
 * @returns {Object[]} - Array of animation objects.
 */
function mEventDialog(){
    const { character, dialog, } = mEvent
    const animationSequence = []
    if(!dialog || !Object.keys(dialog).length)
        return animationSequence
    const { characterId } = character
    const characterDialog = document.getElementById(`char-dialog-${characterId}`)
    if(!characterDialog)
        throw new Error(`Character dialog not found! ${characterId}`)
    const dialogDiv = mCreateCharacterDialog()
    characterDialog.prepend(dialogDiv)
    const { animationDirection, animationDelay, animationDuration, animationIterationCount, effect, } = dialog
    let { animation, } = dialog
    if(animation)
        animation = {
            animationClass: animation,
            animationDelay: animationDelay ?? 0,
            animationDirection: animationDirection ?? 'forwards',
            animationDuration: animationDuration ?? 1,
            animationIterationCount: animationIterationCount ?? 1,
        }
    else animation = { animationClass: 'dialog-fade' }
    animationSequence.push({
        action: 'appear',
        animation,
        dismissable: true, /* click will fast-forward animation */
        effect,
        elementId: dialogDiv.id,
        halt: true, /* requires next in animationSequence to await its completion */
        type: 'dialog',
    })
    return animationSequence
}
/**
 * Reads input data for an event and prepares animation sequence.
 * @todo - create subfunctions for much of this below, in stage painting for hard-objects like moderator and input
 * @private
 * @requires mEvent - The current event object.
 * @returns {Object[]} - Array of animation objects.
 */
function mEventInput(){
    const { input, } = mEvent
    const animationSequence = []
    if(!input)
        return animationSequence
    const { complete, inputId, inputPlaceholder, inputType, variable, } = input
    let element,
        elementId = `chat-member`
    if(complete) // @stub - if complete, do not re-render? determine reaction; is it replay?
        return
    if(mBackdrop==='full'){
        hide(moderatorSubmit)
        elementId = moderator.id
        mCreateModeratorInputDialog()
        element = inputElement
        element.placeholder = inputPlaceholder ?? `What do _you_ think?`
    }
    // @stub - variables are not yet implemented, but could be used for internal fills, checks/balances, like cast
    animationSequence.push({ /* moderator */
        action: 'appear',
        animation: {
            animationClass: 'slide-up',
            animationDelay: 0,
            animationDirection: 'forwards',
            animationDuration: 1,
            animationIterationCount: 1,
        },
        dismissable: true, /* click will fast-forward animation */
        effect: undefined,
        elementId,
        halt: false, /* requires next in animationSequence to await its completion */
        moderatorInputElement: element,
        moderatorInputType: inputType,
        type: 'moderator',
    })
    if(mBackdrop==='full') // full-screen specific animations
        animationSequence.push(
            { /* moderatorDialog */
                action: 'appear',
                animation: undefined,
                dismissable: true, /* click will fast-forward animation */
                effect: undefined,
                elementId: `prompt-${inputId}`,
                halt: false, /* next in animationSequence must await its completion */
                type: 'moderator',
            },{ /* moderatorIcon */
                action: 'appear',
                animation: undefined,
                dismissable: true, /* click will fast-forward animation */
                effect: undefined,
                elementId: `experience-moderator-icon`,
                halt: false, /* requires next in animationSequence to await its completion */
                type: 'moderator',
            })
    return animationSequence
}
/**
 * Retrieves first or next sequence of experience events and updates mExperience object.
 * @private
 * @async
 * @requires mExperience
 * @param {object} memberInput - Member input in form of object
 * @returns {Object[]} - Array of event objects
 */
async function mEvents(memberInput){
    const experienceId = mExperience?.id
    if(!experienceId?.length)
        throw new Error(`Experience id not found: ${ experienceId }`)
    let { autoplay, events, id, location, name, purpose, skippable, } = await globals.datamanager.experienceEvents(experienceId, memberInput)
    if(!events?.length) // @todo - deprecate, could infinity loop
        events = await mEvents()
    mExperience.location = location
    return events
}
/**
 * Reads stage data for an event and prepares animation sequence.
 * @todo - deprecated, heritage check.
 * @private
 * @requires mEvent - The current event object.
 * @returns {Object[]} - Array of animation objects.
 */
function mEventStage(){
    const { action, sceneId, stage, } = mEvent
    const animationSequence = []
    if(stage && Object.keys(stage).length){
        const { backdrop=mBackdropDefault, click, type } = stage
        /* animate stage */
        if((type ?? 'script')!==`script`) // enum: [script, prompt, ...?]
            throw new Error(`Stage type not implemented: ${type}`) // @stub - add dynamic css stage direction
        if(click){
            animationSequence.push({
                action: 'click',
                // class: '', /* @stub - add dynamic css stage direction */
                // animation: '', /* @stub - add dynamic css stage direction */
                dismissable: true, /* click will dismiss animation */
                elementId: 'experience-continue',
                halt: true, /* requires next in animationSequence to await its completion */
                sceneId,
                type: 'stage',
            })
        }
    }
    /* add end-scene/act stage animation */
    if(action==='end'){
        const { type: eventType, title, } = mEvent
        sceneContinueText.textContent = `End of ${ eventType }: ` + title
        animationSequence.push({ action: 'end', type: eventType, sceneId }) // minified to trigger functionality
    }
    return animationSequence
}
/**
 * Get experiences from server according to scope or universal.
 * @param {string} scope - The scope of the experiences to retrieve; undefined=all.
 * @returns {Promise<Experience[]>} - The return is an array of Experience objects.
 */
async function mGetExperiences(scope){
    const experiences = []
    // @stub - member experience fetch goes here
    /* system experiences */
    if((scope ?? 'system')==='system'){
        let systemExperiences = await globals.datamanager.experiences()
        // mGetExperiencesFromServer(`/experiences`)
        systemExperiences = systemExperiences?.experiences
            ?? systemExperiences
            ?? experiences
        if(systemExperiences?.length)
            experiences.push(...systemExperiences.filter(
                experience=>!experiences.some(_experience=>_experience.id===experience.id)
            ))
    }
    return experiences
}
/**
 * Get scene data from navigation.
 * @private
 * @requires mExperience - The Experience object.
 * @param {Guid} sceneId 
 * @returns 
 */
function mGetScene(sceneId){
    const { navigation, } = mExperience
    return navigation.find(nav=>nav.id===sceneId)
}
/**
 * Returns the presumed source of an image based on type and icon data.
 * @private
 * @param {string} icon - The character icon link text.
 * @param {string} type - The character type.
 * @returns 
 */
function mImageSource(icon, type){
    if(icon.includes('http')) return icon
    let iconFile = icon.split('/').pop()
    const iconName = iconFile.split('.').shift().toLowerCase() ?? type
    const iconExtension = iconFile.split('.').length > 1
        ? iconFile.split('.').pop().toLowerCase()
        : 'png'
    iconFile = `../${iconExtension}/experience-icons/system/${iconName}.${iconExtension}` // @stub - add path to individual contributions or uploaded files
    return iconFile
}
/**
 * Initialize experience listeners.
 * @private
 * @requires mExperience - The Experience object.
 * @returns {void}
 */
function mInitListeners(skippable=true){
    if(skippable)
        closeButton.addEventListener('click', experienceEnd)
}
/**
 * Whether the character is the personal-avatar.
 * @private
 * @param {string} type - The character type.
 * @returns {boolean} - Whether the character is the personal-avatar.
 */
function mIsAvatar(type){
    const avatarList = ['avatar', 'personal-avatar', 'member-ai', 'member-bot']
    return avatarList.some(item => item === type.trim().toLowerCase()) 
}
/**
 * Whether the character is a member.
 * @private
 * @param {string} type - The character type.
 * @returns {boolean} - Whether the character is a member.
 */
function mIsMember(type){
    const memberList = ['member', 'user']
    return memberList.some(item => item === type.trim().toLowerCase())
}
/**
 * Scene transition based on backdrop.
 * @private
 * @requires mExperience - The Experience object.
 * @requires mMainstagePrepared - Whether the mainstage is prepared.
 * @returns {void}
 */
function mSceneTransition(){
    const { cast, location, } = mExperience
    const { sceneId: upcomingSceneId, } = location
    const { currentScene: currentSceneId=upcomingSceneId, skippable=true, } = mExperience
    const upcomingScene = mGetScene(upcomingSceneId)
    if(!upcomingScene)
        throw new Error(`Scene not found! ${currentSceneId}`)
    const { backdrop, } = upcomingScene
    if(mMainstagePrepared && backdrop===mBackdrop)
        return
    /* show mainstage */
    mBackdrop = backdrop
    mShowTransport()
    switch(mBackdrop){
        case 'chat':
        case 'interface':
            /* character lanes */
            cast
                .filter(character=>{
                    const { type, } = character
                    return !mIsMember(type)
                })
                .forEach(character=>{
                    /* create/move character lane */
                    mAddCharacterLane(getSystemChat(), character, true)
                })
            mUpdateModerator(true) // clear moderator
            memberSceneTransition()
            break
        case 'full':
        default:
            /* add character lanes */
            cast
                .filter(character=>{
                    const { type, } = character
                    return !(mIsAvatar(type) || mIsMember(type))
                })
                .forEach(character=>{
                    /* create/move character lane */
                    mAddCharacterLane(sceneStage, character, true)
                })
            /* set initial moderator */
            mUpdateModerator()
            /* animate backstage removal */
            hide(backstage)
            mainstage.classList.add('appear') // requires animation to trigger others
            show(mainstage, mainstageAnimation=>{
                mainstageAnimation.stopPropagation()
                /* final mainstage preparations */
            })
            break
    }
    mMainstagePrepared = true
}
/**
 * Special Showcase: Shows the transport element.
 * @private
 * @requires mBackdrop - The backdrop type.
 * @returns {void}
 */
function mShowTransport(){
    const { name, skippable=true, } = mExperience
    mInitListeners(skippable)
    breadcrumb.innerHTML = `Experience: ${name}`
/*
    if(mBackdrop==='interface')
        hideMemberChat()
*/    show(transport)
}
/**
 * Introduces the concept of an Experience to the member.
 * @private
 * @requires mExperience - The Experience object.
 * @returns {void}
 */
function mStageWelcome(){
    const { description: experienceDescription, name: experienceName, title: experienceTitle, } = mExperience
    title.textContent = experienceTitle ?? experienceName ?? `Untitled Production`
    if(experienceDescription?.length)
        description.textContent = experienceDescription
    mShowTransport()
    startButton.addEventListener('click', experiencePlay)
    screen.addEventListener('animationend', animation=>{
        animation.stopPropagation()
        show(backstage, animation=>{
            show(start)
        })
    }, { once: true })
    screen.classList.add('modal-screen')
    show(screen)
}
/**
 * Toggles the input lane for the moderator.
 * @private
 * @requires mBackdrop - The backdrop type.
 * @param {boolean} display - Whether to hide or show the input lane, default `true`.
 * @returns {void}
 */
function mToggleInputLane(display=true, hidden=false){
    switch(mBackdrop){
        case 'chat':
        case 'interface':
            toggleMemberInput(display, hidden)
            break
        case 'full':
        default:
            if(display){
                hide(moderatorWaiting)
                show(inputElement)
                show(moderator)
            } else {
                hide(inputElement)
                hide(moderatorSubmit)
                show(moderatorWaiting)
                show(moderator)
            }
            if(hidden){
                inputElement.value = ''
                hide(moderator)
            }
            break
    }
}
/**
 * Updates the moderator lane.
 * @private
 * @requires mModerator - populated, not undefined; create prior to this function.
 * @param {boolean} clearModerator - Whether to clear the moderator.
 * @returns {void}
 */
function mUpdateModerator(clearModerator=false){
    if(clearModerator){
        moderatorSubmit.removeEventListener('click', submitInput)
        moderatorDialog.innerHTML = ''
        mModerator = null
        return
    }
    if(!mModerator) // currently moderator is required
        mModerator = mExperience.cast
            .find(character=>mIsAvatar(character.type))
    moderatorIcon.appendChild(mAssignIcon(mModerator))
    moderatorSubmit.addEventListener('click', submitInput)
}
/**
 * Displays the `Welcome` start button, completing instantly all backstage animations.
 * @module
 * @returns {void}
 */
function mUpdateStartButton(){
    // stop all animations running
    backstage.style.animation = 'none'
    startSpinner.classList.add('fade-out')
    startButton.textContent = 'click me'
    startButton.classList.add('pulse')
    hide(startSpinner, animation=>{
        show(startButton)
    })
}
/* exports */
export {
    experienceEnd,
    experiencePlay,
    experiences,
    experienceSkip,
    experienceStart,
    submitInput,
}