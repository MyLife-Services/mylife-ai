/* imports */
import {
    experienceEnd,
    experiencePlay,
    experiences as _experiences,
    experienceSkip,
    experienceStart,
    submitInput,
} from './experience.mjs'
import {
    activeBot,
    getItem,
    refreshCollection,
    setActiveBot as _setActiveBot,
    togglePopup,
    updateItem,
} from './bots.mjs'
import Globals from './globals.mjs'
/* variables */
/* constants */
const mGlobals = new Globals()
const mainContent = mGlobals.mainContent,
    navigation = mGlobals.navigation,
    sidebar = mGlobals.sidebar
/* variables */
let mAutoplay=false,
    mChatBubbleCount=0,
    mMemberId
/* page div variables */
let activeCategory,
    awaitButton,
    botBar,
    chatActiveItem,
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
    console.log('members.mjs::DOMContentLoaded')
    /* **note**: bots run independently upon conclusion */
})
/* public functions */
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
function addMessages(messages, options={}){
    messages.forEach(message=>mAddMessage(message, options))
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
 * @todo - store chat locally for retrieval?
 * @public
 * @returns {void}
 */
function clearSystemChat(){
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
 * Fetches the summary via PA for a specified file.
 * @param {string} fileId - The file ID.
 * @param {string} fileName - The file name.
 * @returns {Promise<object>} - The return is the summary object.
 */
async function fetchSummary(fileId, fileName){
    /* validate request */
    if(!fileId?.length && !fileName?.length)
        throw new Error('fetchSummary::Error()::`fileId` or `fileName` is required')
    return await mFetchSummary(fileId, fileName)
}
function getActiveItem(){

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
        console.log('replaceElement::Error()', error)
        return element
    }
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
 * Sets the active item, ex. `memory`, `entry`, `story` in the chat system for member operation(s).
 * @public
 * @todo - edit title with double-click
 * @requires chatActiveItem
 * @param {Guid} itemId - The item id to set as active.
 * @returns {void}
 */
function setActiveItem(itemId){
    itemId = itemId?.split('_')?.pop()
    const id = `popup-container_${ itemId }`
    const popup = document.getElementById(id)
    if(!itemId || !popup)
        throw new Error('setActiveItem::Error()::valid `id` is required')
    const { title, type, } = popup.dataset
    const chatActiveItemTitleText = document.getElementById('chat-active-item-text')
    const chatActiveItemClose = document.getElementById('chat-active-item-close')
    if(chatActiveItemTitleText){
        chatActiveItemTitleText.innerHTML = ''
        const activeActive = document.createElement('div')
        activeActive.classList.add('chat-active-item-text-active')
        activeActive.id = `chat-active-item-text-active`
        activeActive.innerHTML = `Active:`
        const activeTitle = document.createElement('div')
        activeTitle.classList.add('chat-active-item-text-title')
        activeTitle.id = `chat-active-item-text-title`
        activeTitle.innerHTML = title
        /* append children */
        chatActiveItemTitleText.appendChild(activeActive)
        chatActiveItemTitleText.appendChild(activeTitle)
        chatActiveItemTitleText.dataset.itemId = itemId
        chatActiveItemTitleText.dataset.popupId = popup.id
        chatActiveItemTitleText.dataset.title = title
        chatActiveItemTitleText.addEventListener('click', mToggleItemPopup)
        // @stub - edit title with double-click?
    }
    if(chatActiveItemClose)
        chatActiveItemClose.addEventListener('click', unsetActiveItem, { once: true })
    chatActiveItem.dataset.id = id
    chatActiveItem.dataset.itemId = itemId
    show(chatActiveItem)
}
/**
 * Sets the active item title in the chat system, display-only.
 * @public
 * @param {string} title - The title to set.
 * @param {Guid} itemId - The item ID.
 * @returns {void}
 */
function setActiveItemTitle(title, itemId){
    const chatActiveItemText = document.getElementById('chat-active-item-text')
    if(!chatActiveItemText)
        throw new Error('setActiveItemTitle::Error()::`chatActiveItemText` is required')
    const chatActiveItemTitle = document.getElementById('chat-active-item-text-title')
    if(!chatActiveItemTitle)
        throw new Error('setActiveItemTitle::Error()::`chatActiveItemTitle` is required')
    const { itemId: id, } = chatActiveItemText.dataset
    if(id!==itemId)
        throw new Error('setActiveItemTitle::Error()::`itemId`\'s do not match')
    chatActiveItemTitle.innerHTML = title
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
 * Toggle visibility functionality.
 * @returns {void}
 */
function toggleVisibility(){
    mGlobals.toggleVisibility(...arguments)
}
/**
 * Unsets the active item in the chat system.
 * @public
 * @requires chatActiveItem
 * @returns {void}
 */
function unsetActiveItem(){
    const chatActiveItemTitleText = document.getElementById('chat-active-item-text')
    const chatActiveItemClose = document.getElementById('chat-active-item-close')
    if(chatActiveItemTitleText){
        chatActiveItemTitleText.innerHTML = ''
        chatActiveItemTitleText.dataset.popupId = null
        chatActiveItemTitleText.dataset.title = null
        chatActiveItemTitleText.removeEventListener('click', mToggleItemPopup)
    }
    delete chatActiveItem.dataset.id
    delete chatActiveItem.dataset.itemId
    hide(chatActiveItem)
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
    let { instruction={}, responses=[], success=false, } = response
    if(!success)
        mAddMessage('I\'m sorry, I didn\'t understand that, something went wrong on the server. Please try again.')
    /* process instructions */
    const { itemId, summary, title, } = instruction
    if(instruction?.command?.length){
        switch(instruction.command){
            case 'updateItemSummary':
                if(itemId?.length && summary?.length)
                    updateItem({ itemId, summary, })
                break
            case 'updateItemTitle':
                if(title?.length && itemId?.length){
                    setActiveItemTitle(title, itemId)
                    updateItem({ itemId, title, })
                }
                break
            case 'experience':
                break
            default:
                refreshCollection('story') // refresh memories
                break
        }
    }
    /* process response */
	responses
        .forEach(message=>{
            console.log('mAddMemberMessage::responses', message)
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
    const { bubbleClass, role='agent', typeDelay=2, typewrite=true, } = options
    /* message container */
    const chatMessage = document.createElement('div')
    chatMessage.classList.add('chat-message-container', `chat-message-container-${ role }`)
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
    /* attach children */
    chatMessageTab.appendChild(chatCopy)
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
    chatMessage.addEventListener('mouseleave', event => {
        chatMessageTab.classList.remove('chat-message-tab-hover', `chat-message-tab-hover-${ role }`)
    })
    /* print chat message */
	if(typewrite)
        mTypeMessage(chatBubble, message, typeDelay)
    else {
        chatBubble.insertAdjacentHTML('beforeend', message)
        mScrollBottom()
	}
}
/**
 * Fetches the summary via PA for a specified file.
 * @private
 * @param {string} fileId - The file ID.
 * @param {string} fileName - The file name.
 * @returns {Promise<object>} - The return is the summary object.
 */
async function mFetchSummary(fileId, fileName){
    const url = '/members/summarize'
    const data = {
        fileId,
        fileName,
    }
    let response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    response = await response.json()
    return response
}
function getActiveCategory(){
	return activeCategory
}
/**
 * Initialize module variables based on server fetch.
 * @private
 * @requires mMemberId
 * @returns {Promise<boolean>} - The return is a boolean indicating success.
 */
async function mInitialize(){
    /* fetch primary collections */
    await refreshCollection('story') // memories required
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
    chatInputField.addEventListener('input', toggleInputTextarea)
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
 * MyLife function to obscure an item summary
 * @param {Guid} itemId - The item ID
 * @returns 
 */
async function obscure(itemId){
    const url = '/members/obscure/' + itemId
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    })
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    return await response.json()
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
    chatInputField.placeholder = placeholder ?? chatInputField.placeholder
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
 * Submits a message to MyLife Member Services chat.
 * @requires chatActiveItem
 * @param {string} message - The message to submit.
 * @param {boolean} hideMemberChat - The hide member chat flag, default=`true`.
 * @returns {Promise<object>} - The return is the chat response object.
 */
async function submit(message, hideMemberChat=true){
	if(!message?.length)
		throw new Error('submit(): `message` argument is required')
    if(hideMemberChat)
        toggleMemberInput(false)
	const chatResponse = await mSubmitChat(message)
    if(hideMemberChat)
        toggleMemberInput(true)
    return chatResponse
}
/**
 * Submits message to chat service.
 * @private
 * @async
 * @requires chatActiveItem
 * @param {string} message - The message to submit to the server.
 * @returns {void}
 */
async function mSubmitChat(message) {
    const { action, itemId, } = chatActiveItem.dataset
	const url = window.location.origin + '/members'
    const { id: botId, } = activeBot()
	const request = {
            action,
			botId,
            itemId,
			message,
			role: 'member',
		}
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    }
    let response
	try {
		response = await fetch(url, options)
        if(!response.ok)
            throw new Error('Network response was not ok')
		response = await response.json()
        /* validate response */
        if(typeof response!=='object' || !response?.success){
            console.log('Chat Request Failed', response)
            throw new Error('Chat Request Failed on Server')
        }
        if(!response?.responses?.length){
            console.log('No Responses from Server', response)
            /* add error default message */
            response.responses = [{ message: 'I\'m sorry, Something happened with my server connection, please type `try again` to try again.', role: 'agent' }]
        }
		return response
	} catch (err) {
		console.log('fatal error', err, response)
		return alert(`Error: ${ err.message }`)
	}
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
 * Toggles the input textarea.
 * @param {Event} event - The event object.
 * @returns {void} - The return is void.
 */
function toggleInputTextarea(event){
    chatInputField.style.height = 'auto' // Reset height to shrink if text is removed
    chatInputField.style.height = chatInputField.scrollHeight + 'px' // Set height based on content
	toggleSubmitButtonState()
}
function mToggleItemPopup(event){
    event.stopPropagation()
    event.preventDefault()
    togglePopup(event.target.dataset.popupId, true)
}
function toggleSubmitButtonState() {
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
    fetchSummary,
    getActiveItemId,
    getInputValue,
    getSystemChat,
    mGlobals as globals,
    hide,
    hideMemberChat,
    inExperience,
    obscure,
    replaceElement,
    sceneTransition,
    seedInput,
    setActiveBot,
    setActiveItem,
    setActiveItemTitle,
    show,
    showMemberChat,
    showSidebar,
    stageTransition,
    startExperience,
    submit,
    toggleMemberInput,
    toggleInputTextarea,
    toggleVisibility,
    unsetActiveItem,
    waitForUserAction,
}