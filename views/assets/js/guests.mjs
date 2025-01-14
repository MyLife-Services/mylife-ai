/* imports */
import Globals from './globals.mjs'
/* precursor constants */
const mGlobals = new Globals()
/* constants */
const mAvatarName = mGlobals.getAvatar()?.name
    ?? 'MyLife'
const hide = mGlobals.hide
const mPlaceholder = `Type your message to ${ mAvatarName }...`
const retract = mGlobals.retract
const show = mGlobals.show
window.about = about
window.privacyPolicy = privacyPolicy
/* variables */
let mChallengeMemberId,
    mChatBubbleCount = 0,
    mDefaultTypeDelay = 7,
    mPageType = null,
    mSignupType = 'newsletter'
/* page div variables */
let awaitButton,
    agentSpinner,
    challengeError,
    challengeInput,
    challengeInputText,
    challengeSubmit,
    chatContainer,
    chatInput,
    chatLabel,
    chatSubmit,
    chatSystem,
    chatUser,
    loginSelect,
    mainContent,
    navigation,
    pageLoader,
    privacyContainer,
    sidebar,
    signupButton,
    signupEmailInputField,
    signupErrorMessage,
    signupForm,
    signupHeader,
    signupHumanNameInput,
    signupSuccess,
    signupTeaser
/* page load */
document.addEventListener('DOMContentLoaded', async event=>{
    /* load data */
    const { input, messages, } = await mLoadStart()
    /* display page */
    mShowPage()
    if(messages.length)
        await mAddMessages(messages, {
            bubbleClass: 'agent-bubble',
            typeDelay: 10,
            typewrite: true,
        })
    if(input)
        chatSystem.appendChild(input)
})
/* public functions */
function about(){
    mRoutine('about')
}
function privacyPolicy(){
    mRoutine('privacy')
}
/* private functions */
/**
 * Adds a message to the chat column.
 * @private
 * @param {string} message - The message to add to the chat column.
 * @param {object} options - The options for the chat bubble.
 * @returns`{void}
 */
function mAddMessage(message, options={}){
    const {
        bubbleClass='agent-bubble',
        callback=_=>{},
		typeDelay=mDefaultTypeDelay,
		typewrite=true,
	} = options
    const role = bubbleClass.split('-')[0]
    const isSynthetic = !['chat', 'guest', 'member', 'user', 'visitor'].includes(role)
    /* message container */
    const chatMessage = document.createElement('div')
    chatMessage.classList.add('chat-message-container', `chat-message-container-${ role }`)
    /* message thumbnail */
    if(isSynthetic){
        const messageThumb = document.createElement('img')
        messageThumb.classList.add('chat-thumb')
        messageThumb.id = `message-thumb-${ mChatBubbleCount }`
        messageThumb.src = 'png/Q.png'
        messageThumb.alt = `Q, MyLife's Corporate Intelligence`
        messageThumb.title = `Hi, I'm Q, MyLife's Corporate Synthetic Intelligence. I am designed to help you better understand MyLife's organization, membership, services and vision.`
        chatMessage.appendChild(messageThumb)
    }
    /* message bubble */
	const chatBubble = document.createElement('div')
	chatBubble.classList.add('chat-bubble', (bubbleClass ?? role+'-bubble'))
    chatBubble.id = `chat-bubble-${ mChatBubbleCount }`
    mChatBubbleCount++
    chatMessage.appendChild(chatBubble)
    /* append chat message */
	chatSystem.appendChild(chatMessage)
    if(!message.startsWith('<section>'))
        message = `<section>${message}</section>`
	if(typewrite)
        mTypeMessage(chatBubble, message, typeDelay, callback)
	else {
		chatBubble.insertAdjacentHTML('beforeend', message)
        mScrollBottom()
        callback()
	}
}
/**
 * Adds multiple messages to the chat column.
 * @param {Message[]} messages - The messages to add to the chat column.
 * @param {object} options - The options for the chat bubble.
 * @returns {void}
 */
async function mAddMessages(messages, options={}){
    for (const message of messages) {
        await new Promise(resolve=>{
            mAddMessage(message, {...options, callback: resolve})
        })
    }
}
/**
 * Add `user` type message to the chat column.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mAddUserMessage(event){
    event.preventDefault()
    // Dynamically get the current message element (input or textarea)
    const userMessage = chatInput.value.trim()
    if(!userMessage.length)
        return
    const message = mGlobals.escapeHtml(userMessage) // Escape the user message
    const options = {
        bubbleClass: 'user-bubble',
        typeDelay: 2,
    }
    mSubmitInput(event, message)
    mAddMessage(message, options)
}
/**
 * Creates a challenge element for the user to enter their passphrase. Simultaneously sets modular variables to the instantion of the challenge element. Unclear what happens if multiples are attempted to spawn, but code shouldn't allow for that, only hijax. See the `@required` for elements that this function generates and associates.
 * @private
 * @required challengeError
 * @required challengeInput
 * @required challengeInputText
 * @required challengeSubmit
 * @returns {HTMLDivElement} - The challenge element.
 */
function mCreateChallengeElement(){
    /* input container */
    challengeInput = document.createElement('div')
    challengeInput.className = 'challenge-input'
    challengeInput.id = 'challenge-input'
    const challengeInputContainer = document.createElement('div')
    challengeInputContainer.className = 'challenge-input-container'
    /* input field */
    challengeInputText = document.createElement('input')
    challengeInputText.addEventListener('input', mToggleChallengeSubmitButton)
    challengeInputText.className = 'challenge-input-text'
    challengeInputText.id = 'challenge-input-text'
    challengeInputText.placeholder = 'Enter your passphrase...'
    challengeInputText.type = 'password'
    challengeInputContainer.appendChild(challengeInputText)
    /* submit button */
    challengeSubmit = document.createElement('button')
    challengeSubmit.addEventListener('click', mSubmitChallenge)
    challengeSubmit.className = 'challenge-submit'
    challengeSubmit.id = 'challenge-submit'
    challengeSubmit.innerHTML = 'Enter MyLife'
    challengeInputContainer.appendChild(challengeSubmit)
    challengeInput.appendChild(challengeInputContainer)
    /* requires challengeSubmit */
    challengeInputText.addEventListener('keydown', event=>{
        if(event.key==='Enter')
            challengeSubmit.click()
    })
    /* error message */
    challengeError = document.createElement('div')
    challengeError.className = 'challenge-error'
    challengeError.id = 'challenge-error'
    challengeInput.appendChild(challengeError)
    hide(challengeError)
    hide(challengeSubmit)
    return challengeInput
}
/**
 * Fetches the greeting messages or start routine from the server.
 * @private
 * @requires mGlobals
 * @requires mPageType
 * @returns {Object} - Fetch response object: { input, messages, }
 */
async function mFetchStart(){
    const isSignedUp = await mGlobals.datamanager.signupStatus()
    !isSignedUp
        ? retract(signupSuccess)
        : mSignupSuccess()
    const messages = []
    let input // HTMLDivElement containing input element
    switch(mPageType){
        case 'about':
        case 'privacy-policy':
            break
        case 'challenge':
        case 'login':
        case 'select':
            if(mChallengeMemberId){
                await mAddMessage(`Please enter the passphrase for your account to continue...`, { typeDelay: 6, })
                chatSystem.appendChild(mCreateChallengeElement())
                mScrollBottom()
            } else
                messages.push(`I'm sorry, I can't find the member you're looking for...`)
            break
        default:
            messages.push(...await mGlobals.datamanager.greetings())
            break
    }
    return {
        input,
        messages,
    }
}
/**
 * Initializes event listeners.
 * @private
 * @returns {void}
 */
function mInitializeListeners(){
    signupButton.addEventListener('click', mSubmitSignup)
    signupEmailInputField.addEventListener('input', mUpdateFormState)
    signupHumanNameInput.addEventListener('input', mUpdateFormState)
    if(chatInput)
        chatInput.addEventListener('input', mToggleInputTextarea)
    if(chatSubmit)
        chatSubmit.addEventListener('click', mAddUserMessage)
}
/**
 * Determines page type and loads data.
 * @private
 * @returns {Message[]} - The response Message array.
 */
async function mLoadStart(){
    /* assign page div variables */
    awaitButton = document.getElementById('await-button')
    agentSpinner = document.getElementById('agent-spinner')
    chatContainer = document.getElementById('chat-container')
    chatLabel = document.getElementById('user-chat-label')
    chatInput = document.getElementById('chat-user-message')
    chatSubmit = document.getElementById('chat-user-submit')
    chatSystem = document.getElementById('chat-system')
    chatUser = document.getElementById('chat-user')
    mainContent = mGlobals.mainContent
    navigation = mGlobals.navigation
    pageLoader = document.getElementById('page-loader')
    privacyContainer = document.getElementById('privacy-container')
    sidebar = mGlobals.sidebar
    signupButton = document.getElementById('signup-submit')
    signupEmailInputField = document.getElementById('email-input-text')
    signupErrorMessage = document.getElementById('signup-error-message')
    signupForm = document.getElementById('signup-form')
    signupHeader = document.getElementById('signup-header')
    signupHumanNameInput = document.getElementById('human-name-input-text')
    signupSuccess = document.getElementById('signup-success')
    signupTeaser = document.getElementById('signup-teaser')
    /* load page */
    mChallengeMemberId = new URLSearchParams(window.location.search).get('mbr')
    mPageType = new URLSearchParams(window.location.search).get('type')
        ?? window.location.pathname.split('/').pop()
    const startObject = await mFetchStart()
    return startObject
}
/**
 * Retrieves and runs the requested routine.
 * @param {string} routineName - The routine name to execute
 * @returns {Promise<void>}
 */
async function mRoutine(routineName){
    const { error, responses=[], routine: routineScript, success, } = await mGlobals.datamanager.routine(routineName)
    if(success && routineScript){
        const { events: _events, title, } = routineScript
        const events = _events
            .filter(event=>event?.dialog?.message?.length)
            .map(event=>{
                let message = event.dialog.message
                return message
            })
        mAddMessages(events, { bubbleClass: 'system-bubble', responseDelay: 6, typeDelay: 4, typewrite: true, })
    } else if(responses?.length)
        mAddMessages(responses, { responseDelay: 4, typeDelay: 1, typewrite: true, })
    else if(error.message)
        mAddMessage(error.message, { bubbleClass: 'system-bubble', typeDelay: 1, typewrite: true, })
}
/**
 * Scrolls overflow of system chat to bottom.
 * @returns {void}
 */
function mScrollBottom(){
    chatSystem.scrollTop = chatSystem.scrollHeight
}
/**
 * Display the entire page.
 * @todo - refactor for special pages
 * @private
 * @returns {void}
 */
function mShowPage(){
    /* DOM elements */
    signupEmailInputField.tabIndex = 1
    signupHumanNameInput.tabIndex = 2
    /* assign listeners */
    mInitializeListeners()
    /* display elements */
    hide(pageLoader)
    show(navigation)
    document.querySelectorAll('.mylife-widget')
        .forEach(widget=>{
            const guestStatus = (widget.dataset?.requireLogin ?? "false")==="false"
            if(guestStatus)
                show(widget)
            else
                hide(widget)
        })
    show(sidebar)
    show(mainContent)
    if(!chatInput)
        return
    chatInput.value = null
    chatInput.placeholder = mPlaceholder
    show(chatSystem)
    show(chatContainer)
    if(mPageType!=='select')
        show(chatUser)
    else
        hide(chatUser)
    console.log('guests::mShowPage::shown')
}
function mSignupSuccess(){
    retract(signupForm)
    retract(signupTeaser)
    show(signupSuccess)
    signupHeader.innerHTML = `Thank you for joining our pilot!`
}
/**
 * Submits a challenge response to the server.
 * @module
 * @async
 * @requires mChallengeMemberId
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSubmitChallenge(event){
	event.preventDefault()
    event.stopPropagation()
    const { id, value: passphrase, } = challengeInputText
    if(!passphrase.trim().length > 3 || !mChallengeMemberId)
        return
    hide(challengeSubmit)
	const validatePassphrase = await mGlobals.datamanager.submitPassphrase(passphrase, mChallengeMemberId)
	if(validatePassphrase)
        location.href = '/members'
    else {
        challengeError.innerHTML = 'incorrect passphrase, please try again.';
        challengeInputText.value = null
        challengeInputText.placeholder = 'Oops! Try your passphrase again...'
        show(challengeError)
        challengeInputText.focus()
    }
}
/**
 * Submits a message to the server.
 * @param {Event} event - The event object.
 * @param {string} message - The message to submit. 
 */
async function mSubmitInput(event, message){
    if(!message)
        return
    event.stopPropagation()
	event.preventDefault()
    hide(chatUser)
    show(awaitButton)
    const chatData = {
        message,
        role: 'user',
    }
	const { responses, success, } = await mGlobals.datamanager.submitChat(chatData)
	responses.forEach(gptMessage=>{
		mAddMessage(gptMessage.message)
	})
    hide(awaitButton)
    chatInput.value = null
    chatInput.placeholder = mPlaceholder
    mToggleInputTextarea()
    show(chatUser)
}
/**
 * Submits the signup form to the server.
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSubmitSignup(event){
    const { value: email, } = signupEmailInputField
    const { value: humanName, } = signupHumanNameInput
    const formData = {
        avatarName: humanName,
        email,
        humanName,
        type: mSignupType,
    }
    const success = mGlobals.datamanager.signup(formData)
    if(success)
        mSignupSuccess()
    else {
        const signupInputContainer = document.getElementById('signup-input-container')
        if(signupInputContainer){
            const errorDiv = document.createElement('div')
            errorDiv.textContent = `Please review your inputs, system cannot process your request.`
            errorDiv.classList.add('error-message')
            signupInputContainer.prepend(errorDiv)
            errorDiv.addEventListener('animationend', _=>errorDiv.remove())
            setTimeout(_=>{
                errorDiv.classList.add('fade-out')
            }, 6000)
        }
    }
}
/**
 * Toggles the visibility of the challenge submit button based on `input` event.
 * @requires mChallengeSubmit
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mToggleChallengeSubmitButton(event){
    const { value, } = this
    if(value.trim().length > 3){
        challengeSubmit.disabled = false
        challengeSubmit.style.cursor = 'pointer'
        show(challengeSubmit)
    } else {
        challengeSubmit.disabled = true
        challengeSubmit.style.cursor = 'not-allowed'
        hide(challengeSubmit)
    }
}
function mToggleInputTextarea() {
    chatInput.style.height = 'auto' // Reset height to shrink if text is removed
    chatInput.style.height = chatInput.scrollHeight + 'px' // Set height based on content
	mToggleSubmitButton()
}
/**
 * Toggles the disabled state of a button based on the input element value.
 * @private
 * @returns {void}
 */
function mToggleSubmitButton(){
    const hasInput = chatInput.value.trim().length ?? false
    chatSubmit.disabled = !hasInput
    chatSubmit.style.cursor = hasInput ? 'pointer' : 'not-allowed'
}
/**
 * Types a message in the chat bubble.
 * @param {HTMLDivElement} chatBubble - The chat bubble element.
 * @param {string} message - The message to type.
 * @param {number} typeDelay - The delay between typing each character.
 * @returns {void}
 */
function mTypeMessage(chatBubble, message, typeDelay=mDefaultTypeDelay, callback){
    let i = 0
    let tempMessage = ''
    function _typewrite() {
        if(i <= message.length ?? 0){
            tempMessage += message.charAt(i)
            chatBubble.innerHTML = ''
            chatBubble.insertAdjacentHTML('beforeend', tempMessage)
            i++
            setTimeout(_typewrite, typeDelay) // Adjust the typing speed here (50ms)
        } else {
            chatBubble.setAttribute('status', 'done')
            callback()
        }
        mScrollBottom()
    }
    _typewrite()
}
/**
 * Updates the form input and button states based on the input fields.
 * @private
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mUpdateFormState(event){
    const { value: emailValue, } = signupEmailInputField
    const { value: humanNameValue, } = signupHumanNameInput
    signupButton.disabled = !(
           emailValue?.length > 5
        && humanNameValue.trim()?.length > 2
    )
}