/* imports */
import {
    experienceEnd,
    experiencePlay,
    experiences as _experiences,
    experienceSkip,
    experienceStart,
    routine,
    submitInput,
} from './experience.mjs'
import {
    activeBot,
    createItem,
    endMemory,
    getAction,
    getBot,
    getBotIcon,
    getItem,
    refreshCollection,
    setActiveBot as _setActiveBot,
    togglePopup,
    updateItem,
    updateItemTitle,
    updateTitle,
} from './bots.mjs'
import Globals from './globals.mjs'
/* variables */
/* constants */
const mGlobals = new Globals()
const mainContent = mGlobals.mainContent,
    navigation = mGlobals.navigation,
    sidebar = mGlobals.sidebar
window.about = about
window.privacyPolicy = privacyPolicy
/* variables */
let mAutoplay=false,
    mChatBubbleCount=0,
    mMemberId
/* page div variables */
let activeCategory,
    awaitButton,
    botBar,
    chatActiveItem,
    chatActiveThumb,
    chatContainer,
    chatInput,
    chatInputField,
    chatRefresh,
    memberSubmit,
    pageLoader,
    sceneContinue,
    screen,
    spinner,
    systemChat,
    transport
/* page load listener */
document.addEventListener('DOMContentLoaded', async event=>{
    /* post-DOM population constants */
    awaitButton = document.getElementById('await-button')
    botBar = document.getElementById('bot-bar')
    chatActiveItem = document.getElementById('chat-active-item')
    chatActiveThumb = document.getElementById('chat-active-item-thumb')
    chatContainer = document.getElementById('chat-container')
    chatInput = document.getElementById('chat-member')
    chatInputField = document.getElementById('chat-member-input')
    chatRefresh = document.getElementById('chat-refresh')
    memberSubmit = document.getElementById('chat-member-submit')
    pageLoader = document.getElementById('page-loader')
    sceneContinue = document.getElementById('experience-continue')
    spinner = document.getElementById('agent-spinner')
    transport = document.getElementById('experience-transport')
    screen = document.getElementById('experience-modal')
    systemChat = document.getElementById('chat-system')
    /* determine mode, default = member bot interface */
    await mInitialize() // throws if error
    stageTransition()
    unsetActiveAction()
    console.log('members.mjs::DOMContentLoaded')
})
/* public functions */
/**
 * Presents the `about` page as a series of sectional responses from your avatar.
 * @public
 * @async
 * @returns {void}
 */
function about(){
    mRoutine('about')
}
/**
 * Adds an input element (button, input, textarea,) to the system chat column.
 * @param {HTMLElement} HTMLElement - The HTML element to add to the system chat column.
 * @returns {void}
 */
function addInput(HTMLElement){
    systemChat.appendChild(HTMLElement)
}
/**
 * Pushes message content to the chat column.
 * @public
 * @param {string} message - The message object to add to column.
 * @param {object} options - The options object { bubbleClass, typeDelay, typewrite }.
 * @returns {void}
 */
function addMessage(message, options={}){
    mAddMessage(message, options)
}
/**
 * Pushes an array of messages to the chat column.
 * @param {Array} messages - The array of string messages to add to the chat column.
 * @param {object} options - The options object { bubbleClass, typeDelay, typewrite }.
 * @returns {void}
 */
function addMessages(messages, options={}) {
    const { responseDelay=0, } = options
    for(let i=0; i<messages.length; i++)
        if(responseDelay)
            setTimeout(_=>mAddMessage(messages[i], options), i * responseDelay * 1000)
        else
            mAddMessage(messages[i], options)
}
/**
 * Removes and attaches all payload elements to element.
 * @public
 * @param {HTMLDivElement} parent - The moderator element.
 * @param {object[]} elements - The elements to append to moderator.
 * @param {boolean} clear - The clear flag to remove previous children, default=`true`.
 * @returns {HTMLDivElement} - The moderator modified element.
 */
function assignElements(parent=chatInput, elements, clear=true){
    if(clear)
        while(parent.firstChild)
            parent.removeChild(parent.firstChild)
    elements.forEach(element=>parent.appendChild(element))
}
/**
 * Clears the system chat by removing all chat bubbles instances.
 * @public
 * @returns {void}
 */
function clearSystemChat(){
    activeBot().interactionCount = 0
    mGlobals.clearElement(systemChat)
}
/**
 * Called from setActiveBot, triggers any main interface changes as a result of new selection.
 * @public
 * @param {object} activeBot - The active bot.
 * @returns {void}
 */
function decorateActiveBot(){
    const { id, name, } = activeBot()
    chatInputField.placeholder = `Type your message to ${ name }...`
    // additional func? clear chat?
}
function escapeHtml(text) {
    return mGlobals.escapeHtml(text)
}
function experiences(){
    return _experiences()
}
/**
 * Deletes an element from the DOM via Avatar functionality.
 * @param {HTMLElement} element - The element to expunge.
 * @returns {void}
 */
function expunge(element){
    return mGlobals.expunge(element)
}
/**
 * Gets the active chat item id to send to server.
 * @requires chatActiveItem
 * @returns {Guid} - The return is the active item ID.
 */
function getActiveItemId(){
    const id = chatActiveItem.dataset?.id?.split('_')?.pop()
    return id
}
function getInputValue(){
    return chatInputField.value.trim()
}
/**
 * Gets the member chat system DOM element.
 * @returns {HTMLDivElement} - The member chat system element.
 */
function getSystemChat(){
    return systemChat
}
/**
 * Proxy for Globals.hide().
 * @param {HTMLElement} element - The element to hide.
 * @param {function} callbackFunction - The callback function to execute after the element is hidden.
 * @returns {void}
 */
function hide(){
    mGlobals.hide(...arguments)
}
function hideMemberChat(){
    hide(navigation)
    hide(chatInput)
    hide(sidebar)
}
/**
 * Determines whether an experience is in progress.
 * @returns {boolean} - The return is a boolean indicating whether an experience is in progress.
 */
function inExperience(){
    return mExperience?.id?.length ?? false
}
/**
 * Presents the `introduction` routine.
 * @public
 * @returns {void}
 */
function introduction(){
    clearSystemChat()
    mRoutine('introduction')
}
/**
 * Consumes instruction object and performs the requested actions.
 * @todo - all interfaceLocations supported
 * @todo - currently just force-feeding _all_ the functions I need; make more contextual
 * @param {object} instruction - The instruction object
 * @param {string} interfaceLocation - The interface location, default=`chat`
 * @param {object} additionalFunctions - The additional functions object, coming from other module requests
 * @returns {void}
 */
function enactInstruction(instruction, interfaceLocation='chat', additionalFunctions={}){
    if(!instruction || interfaceLocation!='chat')
        return
    const functions = {
        addInput,
        addMessages,
        ...additionalFunctions, // overloads feasible
    }
    mGlobals.enactInstruction(instruction, functions)
}
/**
 * Presents the `privacy-policy` page as a routine.
 * @public
 * @returns {void}
 */
function privacyPolicy(){
    mRoutine('privacy')
}
/**
 * Replaces an element (input/textarea) with a specified type.
 * @param {HTMLInputElement} element - The element to replace.
 * @param {string} newType - The new element type.
 * @param {boolean} retainValue - Whether or not to keep the value of the original element, default=true.
 * @param {string} onEvent - The event to listen for.
 * @param {function} listenerFunction - The listener function to execute.
 * @returns {HTMLInputElement} - The new element.
 */
function replaceElement(element, newType, retainValue=true, onEvent, listenerFunction){
    const newElementType = ['select', 'textarea'].includes(newType)
        ? newType
        : 'input'
    try{
        const newElement = document.createElement(newElementType)
        newElement.id = element.id
        newElement.name = element.name
        newElement.required = element.required
        newElement.classList = element.classList
        /* type-specific alterations */
        switch(newType){
            case 'select':
                break
            case 'textarea':
                newElement.placeholder = element.placeholder /* input, textarea */
                if(retainValue)
                    newElement.value = element.value
                newElement.setAttribute('rows', '3')
                break
            case 'checkbox':
            case 'radio':
            case 'text':
            default:
                newElement.placeholder = element.placeholder /* input, textarea */
                newElement.type = newType /* input variants [text, checkbox, radio, etc.] */
                if(retainValue)
                    newElement.value = element.value
                break
        }
        if(onEvent){
            newElement.addEventListener(onEvent, listenerFunction) // Reattach event listener
        }
        element.parentNode.replaceChild(newElement, element)
        return newElement
    } catch(error){
        return element
    }
}
/**
 * Sets the active item to an `action` determined by the requesting bot.
 * @public
 * @requires chatActiveItem
 * @requires chatActiveThumb
 * @param {object} instructions - The action object describing how to populate { button, callback, icon, status, text, thumb, }.
 * @property {string} button - The button text; if false-y, no button is displayed
 * @property {function} callback - The callback function to execute on button click
 * @property {string} icon - The icon class to display
 * @property {string} status - The status text to display
 * @property {string} text - The text to display
 * @property {string} thumb - The thumbnail image URL
 * @returns {void}
 */
function setActiveAction(instructions){
    if(!instructions)
        return
    mGlobals.clearDataset(chatActiveItem.dataset)
    chatActiveItem.dataset.inAction = "true"
    const { button, callback, icon, status, text, thumb, } = instructions
    const activeButton = document.getElementById('chat-active-item-button')
    const activeClose = document.getElementById('chat-active-item-close')
    const activeIcon = document.getElementById('chat-active-item-icon')
    const activeStatus = document.getElementById('chat-active-item-status')
    const activeTitle = document.getElementById('chat-active-item-title')
    mGlobals.clearDataset(chatActiveThumb.dataset)
    chatActiveThumb.className = 'fas chat-active-action-thumb'
    if(thumb?.length)
        chatActiveThumb.src = thumb
    else
        hide(chatActiveThumb)
    if(activeIcon){
        mGlobals.clearDataset(activeIcon.dataset)
        activeIcon.className = 'fas chat-active-action-icon'
        if(icon?.length)
            activeIcon.classList.add(icon)
        else
            hide(activeIcon)
    }
    if(activeStatus){
        mGlobals.clearDataset(activeStatus.dataset)
        activeStatus.className = 'chat-active-action-status'
        activeStatus.removeEventListener('click', mToggleItemPopup)
        if(status?.length)
            activeStatus.textContent = status
        else
            hide(activeStatus)
    }
    if(activeButton){
        mGlobals.clearDataset(activeButton.dataset)
        activeButton.className = 'button chat-active-action-button'
        if(button?.length){
            activeButton.textContent = button
            if(callback){
                activeButton.addEventListener('click', callback, { once: true })
                activeButton.disabled = false
            }
        } else
            hide(activeButton)
    }
    if(activeTitle){
        mGlobals.clearDataset(activeTitle.dataset)
        activeTitle.className = 'chat-active-action-title'
        if(text?.length)
            activeTitle.textContent = text
        else
            hide(activeTitle)
    }
    if(activeClose){
        mGlobals.clearDataset(activeClose.dataset)
        activeClose.addEventListener('click', unsetActiveAction, { once: true })
    }
    show(chatActiveItem)
}
/**
 * Proxy to set the active bot (via `bots.mjs`).
 * @public
 * @async
 * @returns {Promise<void>} - The return is its own success.
 */
async function setActiveBot(){
    return await _setActiveBot(...arguments)
}
/**
 * Sets the active item, ex. `memory`, `entry` in the chat system for member operation(s).
 * @public
 * @requires chatActiveItem
 * @param {Guid} itemId - The item id to set as active
 * @returns {void}
 */
function setActiveItem(itemId){
    mGlobals.clearDataset(chatActiveItem.dataset)
    if(!mGlobals.isGuid(itemId))
        return
    const popup = document.getElementById(`popup-container_${ itemId }`)
    if(!popup)
        return
    const { form='journal', title, type, } = popup.dataset
    const activeButton = document.getElementById('chat-active-item-button')
    const activeClose = document.getElementById('chat-active-item-close')
    const activeIcon = document.getElementById('chat-active-item-icon')
    const activeStatus = document.getElementById('chat-active-item-status')
    const activeTitle = document.getElementById('chat-active-item-title')
    if(activeButton)
        hide(activeButton)
    if(activeClose){
        activeClose.className = 'fas fa-times chat-active-item-close'
        activeClose.addEventListener('click', unsetActiveItem, { once: true })
    }
    if(activeIcon){
        activeIcon.className = 'fas fa-square chat-active-item-icon'
    }
    if(activeStatus){
        activeStatus.className = 'chat-active-item-status'
        activeStatus.dataset.itemId = itemId
        activeStatus.textContent = 'Active: '
        activeStatus.addEventListener('click', mToggleItemPopup)
    }
    if(activeTitle){
        activeTitle.innerHTML = ''
        const activeText = document.createElement('div')
        activeText.classList.add('chat-active-item-title-text')
        activeText.dataset.itemId = itemId
        activeText.id = `chat-active-item-title-text_${ itemId }`
        activeText.innerHTML = title
        /* append activeTitle */
        activeTitle.appendChild(activeText)
        activeTitle.className = 'chat-active-item-title'
        activeTitle.dataset.itemId = itemId
        activeTitle.dataset.popupId = popup.id
        activeTitle.dataset.title = title
        activeTitle.addEventListener('dblclick', updateTitle, { once: true })
    }
    chatActiveItem.dataset.form = form
    chatActiveItem.dataset.id = itemId
    chatActiveItem.dataset.inAction = "false"
    chatActiveItem.dataset.itemId = itemId
    chatActiveItem.dataset.type = type
    function getBotType(itemType){
        switch(itemType){
            case 'memory':
                return 'biographer'
            case 'entry':
                return form==='journal'
                    ? 'journaler'
                    : 'diary'
            default:
                return 'avatar'
        }
    }
    const botType = getBotType(type)
    const { id, } = getBot(botType)
    if(id)
        setActiveBot(id, false)
    show(chatActiveItem)
}
/**
 * Proxy for Globals.show().
 * @public
 * @param {HTMLElement} element - The element to show.
 * @param {function} listenerFunction - The listener function, defaults to `mAnimationEnd`.
 * @returns {void}
 */
function show(){
    mGlobals.show(...arguments)
}
/**
 * Shows the member chat system.
 * @public
 * @returns {void}
 */
function showMemberChat(){
    hide(screen)
    show(mainContent)
    show(chatContainer)
    show(systemChat)
}
/**
 * Shows the sidebar.
 * @public
 * @returns {void}
 */
function showSidebar(){
    show(sidebar)
}
/**
 * Enacts stage transition.
 * @public
 * @param {string} experienceId - The experience ID, optional.
 * @returns {void}
 */
function stageTransition(experienceId){
    if(mGlobals.isGuid(experienceId))
        experienceStart(experienceId)
    else
        mStageTransitionMember()
}
/**
 * Start experience onscreen, displaying welcome ande loading remaining data. Passthrough to `experience.mjs::experienceStart()`.
 * @public
 * @param {Guid} experienceId - The Experience id
 * @returns {void}
 */
async function startExperience(experienceId){
    await experienceStart(experienceId)
}
/**
 * Submits a message to MyLife Member Services chat.
 * @async
 * @requires chatActiveItem
 * @param {string} message - The message to submit
 * @param {boolean} hideMemberChat - The hide member chat flag, default=`true`
 * @returns {Promise<object>} - The return is the chat response object: { instruction, responses, success, }
 */
async function submit(message, hideMemberChat=true){
	if(!message?.length)
		throw new Error('submit(): `message` argument is required')
    if(hideMemberChat)
        toggleMemberInput(false)
    const { itemId, } = chatActiveItem.dataset
    const { id: botId, } = activeBot()
	const request = {
			botId,
            itemId,
			message,
			role: 'member',
		}
	const response = await mGlobals.datamanager.submitChat(request, true)
    if(hideMemberChat)
        toggleMemberInput(true)
    return response
}
/**
 * Toggles the member input between input and server `waiting`.
 * @public
 * @param {boolean} display - Whether to show/hide (T/F), default `true`.
 * @param {boolean} hidden - Whether to force-hide (T/F), default `false`. **Note**: used in `experience.mjs`
 * @param {boolean} connectingText - The server-connecting text, default: `Connecting with `.
 * @returns {void}
 */
function toggleMemberInput(display=true, hidden=false, connectingText='Connecting with '){
    const { id, name, } = activeBot()
    if(display){
        hide(awaitButton)
        awaitButton.classList.remove('slide-up')
        chatInput.classList.add('slide-up')
        chatInputField.style.height = 'auto'
        chatInputField.placeholder = `type your message to ${ name }...`
        chatInputField.value = null
        show(chatInput)
    } else {
        hide(chatInput)
        chatInput.classList.remove('fade-in')
        chatInput.classList.remove('slide-up')
        awaitButton.classList.add('slide-up')
        awaitButton.innerHTML = connectingText + name + '...'
        show(awaitButton)
    }
    if(hidden){
        hide(chatInput)
        hide(awaitButton)
    }
}
/**
 * Toggles the visibility of an element with option to force state.
 * @param {HTMLElement} element - The element to toggle.
 * @param {boolean} bForceState - The state to force the element to, defaults to `null`.
 * @returns {void}
 */
function toggleVisibility(){
    mGlobals.toggleVisibility(...arguments)
}
/**
 * Unsets the active action in the chat system.
 * @public
 * @requires chatActiveItem
 * @requires chatActiveThumb
 * @returns {void}
 */
function unsetActiveAction(){
    mGlobals.clearDataset(chatActiveItem.dataset)
    hide(chatActiveThumb)
    hide(chatActiveItem)
}
/**
 * Unsets the active item in the chat system.
 * @public
 * @requires chatActiveItem
 * @returns {void}
 */
function unsetActiveItem(){
    mGlobals.clearDataset(chatActiveItem.dataset)
    hide(chatActiveItem)
}
/**
 * Updates the active item title in the chat system, display-only.
 * @public
 * @param {Guid} itemId - The item ID
 * @param {string} title - The title to set
 * @returns {void}
 */
function updateActiveItemTitle(itemId, title){
    const chatActiveItemText = document.getElementById('chat-active-item-title')
    const chatActiveItemTitle = document.getElementById(`chat-active-item-title-text_${ itemId }`)
    const { itemId: id, } = chatActiveItemText.dataset
    if(id!==itemId)
        throw new Error('updateActiveItemTitle::Error()::`itemId`\'s do not match')
    chatActiveItemTitle.innerHTML = title
}
/**
 * Waits for user action.
 * @public
 * @returns {Promise<void>} - The return is its own success.
 */
function waitForUserAction(){
    return new Promise((resolve)=>{
        show(sceneContinue)
        document.addEventListener('click', ()=>{
            hide(sceneContinue)
            resolve()
        }, { once: true })
    })
}
/* private functions */
/**
 * Adds a message to the chat column on member's behalf.
 * @todo - normalize return from backend so no need for special processing.
 * @private
 * @async
 * @requires chatInputField
 * @param {Event} event - The event object.
 * @returns {Promise<void>}
 */
async function mAddMemberMessage(event){
    event.stopPropagation()
	event.preventDefault()
    const Bot = activeBot() // lock in here `await`
    let memberMessage = chatInputField.value.trim()
    if (!memberMessage.length)
        return
    /* prepare request */
    toggleMemberInput(false) /* hide */
    mAddMessage(memberMessage, {
        bubbleClass: 'user-bubble',
        role: 'member',
        typeDelay: 7,
    })
    /* server request */
    const response = await submit(memberMessage)
    let { instruction, responses=[], success=false, } = response
    if(!success)
        mAddMessage('I\'m sorry, I didn\'t understand that, something went wrong on the server. Please try again.')
    if(!!instruction)
        enactInstruction(instruction, 'chat', {
            createItem,
            updateItem,
            updateItemTitle,
        })
    else {
        if(!Bot.interactionCount)
            Bot.interactionCount = 0
        Bot.interactionCount++
        if(Bot.interactionCount>2){
            setActiveAction(getAction(Bot.type))
            Bot.interactionCount = 0
        }
    }
    /* process response */
	responses
        .forEach(message=>{
            mAddMessage(message.message ?? message.content, {
                bubbleClass: 'agent-bubble',
                role: 'agent',
                typeDelay: 1,
            })
        })
    toggleMemberInput(true) /* show */
}
/**
 * Adds specified string message to interface.
 * @param {object|string} message - The message to add to the chat; if object, reduces to `.message` or fails.
 * @param {object} options - The options object { bubbleClass, role, typeDelay, typewrite }.
 * @returns {void}
 */
async function mAddMessage(message, options={}){
    if(typeof message==='object'){
        if(message?.message){ // otherwise error throws for not string (i.e., Array or classed object)
            options.role = message?.role // overwrite if exists
                ?? options?.role
                ?? 'agent'
            message = message.message
        }
    }
    if(typeof message!=='string' || !message.length)
        throw new Error('mAddMessage::Error()::`message` string is required')
    const {
        bubbleClass,
        role='agent',
        typeDelay=2,
        typewrite=true,
    } = options
    const isSynthetic = !['chat', 'guest', 'member', 'user', 'visitor'].includes(role)
    /* message container */
    const chatMessage = document.createElement('div')
    chatMessage.classList.add('chat-message-container', `chat-message-container-${ role }`)
    /* message thumbnail */
    if(isSynthetic){
        const messageThumb = document.createElement('img')
        messageThumb.classList.add('chat-thumb')
        messageThumb.id = `message-thumb-${ mChatBubbleCount }`
        switch(role){
            case 'system':
                messageThumb.src = getBotIcon('system')
                messageThumb.alt = `Q, MyLife's Corporate Intelligence`
                messageThumb.title = `Hi, I'm Q, MyLife's Corporate Synthetic Intelligence. I am designed to help you better understand MyLife's organization, membership, services and vision.`
                break
            default:
                const bot = activeBot()
                const type = bot.type.split('-').pop()
                messageThumb.src = getBotIcon(type)
                messageThumb.alt = bot.name
                messageThumb.title = bot.purpose
                    ?? `I'm ${ bot.name }, an artificial intelligence ${ type.replace('-', ' ') } designed to assist you!`
                break
        }
        chatMessage.appendChild(messageThumb)
    }
    /* message bubble */
	const chatBubble = document.createElement('div')
	chatBubble.classList.add('chat-bubble', ( bubbleClass ?? role+'-bubble' ))
    chatBubble.id = `chat-bubble-${ mChatBubbleCount }`
    mChatBubbleCount++
    /* message tab */
    const chatMessageTab = document.createElement('div')
    chatMessageTab.id = `chat-message-tab-${ mChatBubbleCount }`
    chatMessageTab.classList.add('chat-message-tab', `chat-message-tab-${ role }`)
    const chatCopy = document.createElement('i')
    chatCopy.classList.add('fas', 'fa-copy', 'chat-copy')
    chatCopy.title = 'Copy content to clipboard'
    const chatSave = document.createElement('i')
    chatSave.classList.add('fas', 'fa-floppy-disk', 'chat-save')
    chatSave.title = 'Save memory directly to MyLife'
    const chatFeedbackPositive = document.createElement('i')
    chatFeedbackPositive.classList.add('fas', 'fa-thumbs-up', 'chat-feedback')
    chatFeedbackPositive.title = 'I like this!'
    const chatFeedbackNegative = document.createElement('i')
    chatFeedbackNegative.classList.add('fas', 'fa-thumbs-down', 'chat-feedback')
    chatFeedbackNegative.title = `I don't care for this.`
    /* attach children */
    chatMessageTab.appendChild(chatCopy)
    if(role==='member')
        chatMessageTab.appendChild(chatSave)
    else {
        chatMessageTab.appendChild(chatFeedbackPositive)
        chatMessageTab.appendChild(chatFeedbackNegative)
    }
    chatMessage.appendChild(chatBubble)
    chatMessage.appendChild(chatMessageTab)
	systemChat.appendChild(chatMessage)
    /* assign listeners */
    chatBubble.addEventListener('mouseover', event=>{
        chatMessageTab.classList.add('chat-message-tab-hover', `chat-message-tab-hover-${ role }`)
    })
    chatCopy.addEventListener('click', event=>{
        navigator.clipboard.writeText(message).then(_=>{
            chatCopy.classList.remove('fa-copy')
            chatCopy.classList.add('fa-check')
            setTimeout(_=>{
                chatCopy.classList.remove('fa-check')
                chatCopy.classList.add('fa-copy')
            }, 2000)
        }).catch(err => {
            console.error('Failed to copy: ', err)
        })
    })
    chatFeedbackNegative.addEventListener('click', async event=>{
        const baseClass = 'fa-thumbs-down'
        chatFeedbackNegative.classList.remove(baseClass)
        chatFeedbackNegative.classList.add('fa-spinner', 'spin')
        const feedbackTimeout = setTimeout(_=>{
            chatFeedbackNegative.classList.remove('fa-spinner', 'spin')
            chatFeedbackNegative.classList.add(baseClass)
        }, 5000)
        const success = await mGlobals.datamanager.feedback(false, message)
        clearTimeout(feedbackTimeout)
        const successClass = success ? 'fa-check' : 'fa-times'
        chatFeedbackNegative.classList.add(successClass)
        chatFeedbackNegative.classList.remove('fa-spinner', 'spin')
        setTimeout(_=>{
            chatFeedbackNegative.remove()
            chatFeedbackPositive.remove()
        }, 2000)
    }, { once: true })
    chatFeedbackPositive.addEventListener('click', async event=>{
        const baseClass = 'fa-thumbs-up'
        chatFeedbackPositive.classList.remove(baseClass)
        chatFeedbackPositive.classList.add('fa-spinner', 'spin')
        const feedbackTimeout = setTimeout(_=>{
            chatFeedbackPositive.classList.remove('fa-spinner', 'spin')
            chatFeedbackPositive.classList.add(baseClass)
        }, 5000)
        const success = await mGlobals.datamanager.feedback(true, message)
        clearTimeout(feedbackTimeout)
        const successClass = success ? 'fa-check' : 'fa-times'
        chatFeedbackPositive.classList.add(successClass)
        chatFeedbackPositive.classList.remove('fa-spinner', 'spin')
        setTimeout(_=>{
            chatFeedbackNegative.remove()
            chatFeedbackPositive.remove()
        }, 2000)
    }, { once: true })
    chatSave.addEventListener('click', async event=>{
        const baseClass = 'fa-floppy-disk'
        chatSave.classList.remove(baseClass)
        chatSave.classList.add('fa-spinner', 'spin')
        const feedbackTimeout = setTimeout(_=>{
            chatFeedbackPositive.classList.remove('fa-spinner', 'spin')
            chatFeedbackPositive.classList.add(baseClass)
        }, 15000)
        const saveMessage = `## PRINT\n${ message }\n`
        const success = await submit(saveMessage, false)
        clearTimeout(feedbackTimeout)
        const successClass = success ? 'fa-check' : 'fa-exclamation-triangle'
        chatSave.classList.add(successClass)
        chatSave.classList.remove('fa-spinner', 'spin')
        setTimeout(_=>{
            if(success)
                chatSave.remove()
            else {
                chatSave.classList.remove(successClass)
                chatSave.classList.add(baseClass)
            }
        }, 2000)
    }, { once: true })
    chatMessage.addEventListener('mouseleave', event => {
        chatMessageTab.classList.remove('chat-message-tab-hover', `chat-message-tab-hover-${ role }`)
    })
    /* chat message */
    if(!message.startsWith('<section>'))
        message = `<section>${message}</section>`
	if(typewrite)
        mTypeMessage(chatBubble, message, typeDelay)
    else {
        chatBubble.insertAdjacentHTML('beforeend', message)
        mScrollBottom()
	}
}
/**
 * Initialize module variables from server.
 * @private
 * @requires mMemberId
 * @returns {Promise<boolean>} - The return is a boolean indicating success.
 */
async function mInitialize(){
    /* retrieve primary collections */
    await refreshCollection('memory') // memories required
    /* page listeners */
    mInitializePageListeners()
}
/**
 * Initialize page listeners.
 * @private
 * @returns {void}
 */
function mInitializePageListeners(){
    /* page listeners */
    chatInputField.addEventListener('input', mToggleInputTextarea)
    memberSubmit.addEventListener('click', mAddMemberMessage) /* note default listener */
    chatRefresh.addEventListener('click', clearSystemChat)
    const currentPath = window.location.pathname // Get the current path
    const navigationLinks = document.querySelectorAll('.navigation-nav .navigation-link') // Select all nav links
    navigationLinks.forEach(link=>{
        if(link.getAttribute('href')===currentPath){
            link.classList.add('active') // Add 'active' class to the current link
            link.addEventListener('click', event=>{
                event.preventDefault() // Prevent default action (navigation) on click
            })
        }
    })
}
/**
 * Retrieves and runs the requested routine.
 * @param {string} routineName - The routine name to execute
 * @returns {Promise<void>}
 */
async function mRoutine(routineName){
    const { error, responses=[], routine: routineScript, success, } = await mGlobals.datamanager.routine(routineName)
    if(success && routineScript)
        routine(routineScript)
    else if(responses?.length)
        addMessages(responses, { responseDelay: 4, typeDelay: 1, typewrite: true, })
    else if(error.message)
        addMessage(error.message, { bubbleClass: 'system-bubble', typeDelay: 1, typewrite: true, })
}
/**
 * Primitive step to set a "modality" or intercession for the member chat. Currently will key off dataset in `chatInputField`.
 * @public
 * @requires chatActiveItem
 * @requires chatInputField
 * @param {Guid} itemId - The Active Item ID
 * @param {Guid} shadowId - The shadow ID
 * @param {string} value - The value to seed the input with
 * @param {string} placeholder - The placeholder to seed the input with (optional)
 */
function seedInput(itemId, shadowId, value, placeholder){
    chatActiveItem.dataset.itemId = itemId
    chatActiveItem.dataset.shadowId = shadowId
    chatInputField.value = value
    chatInputField.placeholder = placeholder
        ?? chatInputField.placeholder
    chatInputField.focus()
}
/**
 * Transitions and sets the stage to experience version of member screen indicated.
 * @public
 * @param {string} type - The type of scene transition, defaults to `interface`.
 * @returns {void}
 */
function sceneTransition(type='interface'){
    /* assign listeners */
    memberSubmit.removeEventListener('click', mAddMemberMessage)
    memberSubmit.addEventListener('click', submitInput)
    /* clear "extraneous" */
    hide(navigation)
    hide(botBar)
    hide(chatInput)
    /* type specifics */
    switch(type){
        case 'chat':
            hide(sidebar)
            break
        case 'interface':
        default:
            show(sidebar)
            break
    }
    /* show member chat */
    showMemberChat()
}
/**
 * Scrolls overflow of system chat to bottom.
 * @returns {void}
 */
function mScrollBottom(){
    systemChat.scrollTop = systemChat.scrollHeight
}
/**
 * Transitions the stage to active member version.
 * @param {boolean} includeSidebar - The include-sidebar flag.
 * @returns {void}
 */
function mStageTransitionMember(includeSidebar=true){
    memberSubmit.removeEventListener('click', submitInput)
    memberSubmit.addEventListener('click', mAddMemberMessage)
    hide(transport)
    hide(screen)
    hide(pageLoader)
    document.querySelectorAll('.mylife-widget')
        .forEach(widget=>{
            const loginRequired = (widget.dataset?.requireLogin ?? "false")==="true"
            if(loginRequired)
                show(widget)
            else
                hide(widget)
        })
    show(mainContent)
    show(navigation)
    show(chatContainer)
    show(systemChat)
    show(chatInput)
    if(includeSidebar && sidebar){
        show(sidebar)
        if(botBar)
            show(botBar)
    }
}
/**
 * Toggles the input textarea, currently triggered with `event`.
 * @public
 * @requires chatActiveItem
 * @requires chatActiveThumb
 * @requires chatInputField
 * @returns {void}
 */
function mToggleInputTextarea(){
    chatInputField.style.height = 'auto' // Reset height to shrink if text is removed
    chatInputField.style.height = chatInputField.scrollHeight + 'px' // Set height based on content
	mToggleSubmitButtonState()
    if(chatActiveItem.dataset.inAction==='true')
        if(!chatInputField.value.length){
            show(chatActiveItem)
            show(chatActiveThumb)
        } else {
            hide(chatActiveItem)
            hide(chatActiveThumb)
        }
}
function mToggleItemPopup(event){
    event.stopPropagation()
    event.preventDefault()
    const { itemId, } = event.target.dataset
    togglePopup(itemId, true)
}
function mToggleSubmitButtonState() {
	memberSubmit.disabled = !(chatInputField.value?.trim()?.length ?? true)
}
/**
 * Typewrites a message to a chat bubble.
 * @param {HTMLDivElement} chatBubble - The chat bubble element.
 * @param {string} message - The message to type.
 * @param {number} typeDelay - The delay between typing each character.
 * @returns {void}
 */
function mTypeMessage(chatBubble, message, typeDelay=mDefaultTypeDelay){
    let i = 0
    let tempMessage = ''
    function _typewrite() {
        if(i <= message.length ?? 0){
            tempMessage += message.charAt(i)
            chatBubble.innerHTML = ''
            chatBubble.insertAdjacentHTML('beforeend', tempMessage)
            i++
            setTimeout(_typewrite, typeDelay) // Adjust the typing speed here (50ms)
        } else
            chatBubble.setAttribute('status', 'done')
        mScrollBottom()
    }
    _typewrite()
}
/* exports */
export {
    addInput,
    addMessage,
    addMessages,
    assignElements,
    clearSystemChat,
    decorateActiveBot,
    escapeHtml,
    experiences,
    expunge,
    getActiveItemId,
    getInputValue,
    getSystemChat,
    mGlobals as globals,
    hide,
    hideMemberChat,
    inExperience,
    introduction,
    enactInstruction,
    privacyPolicy,
    replaceElement,
    routine,
    sceneTransition,
    seedInput,
    setActiveAction,
    setActiveBot,
    setActiveItem,
    show,
    showMemberChat,
    showSidebar,
    stageTransition,
    startExperience,
    submit,
    toggleMemberInput,
    toggleVisibility,
    unsetActiveAction,
    unsetActiveItem,
    updateActiveItemTitle,
    waitForUserAction,
}