/* imports */
import Globals from './globals.mjs'
/* precursor constants */
const mGlobals = new Globals()
/* constants */
const mAvatarName = mGlobals.getAvatar().name
const mGreeting = [
	`Hi, I'm ${ mAvatarName }, so nice to meet you!`,
	`To get started, tell me a little bit about something or someone that is really important to you &mdash; or ask me a question about MyLife.`
]
const hide = mGlobals.hide
const mPlaceholder = `Type a message to ${ mAvatarName }...`
const show = mGlobals.show
/* variables */
let mChatBubbleCount = 0,
    threadId = null,
    typingTimer
/* page div variables */
let awaitButton,
    agentSpinner,
    chatContainer,
    chatInput,
    chatLabel,
    chatSubmit,
    chatSystem,
    chatUser,
    mainContent,
    memberChallenge,
    memberChallengeError,
    memberChallengeSubmit,
    memberSelect,
    navigation,
    sidebar
document.addEventListener('DOMContentLoaded', async ()=>{
    /* assign page div variables */
    awaitButton = document.getElementById('await-button')
    agentSpinner = document.getElementById('agent-spinner')
    chatContainer = document.getElementById('chat-container')
    chatLabel = document.getElementById('user-chat-label')
    chatInput = document.getElementById('chat-user-message')
    chatSubmit = document.getElementById('chat-user-submit')
    chatSystem = document.getElementById('chat-system')
    chatUser = document.getElementById('chat-user')
    mainContent = document.getElementById('main-content')
    memberChallenge = document.getElementById('member-challenge-input-text')
    memberChallengeError = document.getElementById('member-challenge-error')
    memberChallengeSubmit = document.getElementById('member-challenge-submit')
    memberSelect = document.getElementById('member-select')
    navigation = document.getElementById('navigation-container')
    sidebar = document.getElementById('page-sidebar')
    /* display page */
    mShowPage()
})
/* public functions */
/**
 * Escapes HTML characters in a string.
 * @param {string} text - The text to escape.
 * @returns {string} - The escaped text.
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }
    const escapedText = text.replace(/[&<>"']/g, m=>(map[m]) )
    return escapedText
}
/**
 * Redirects to the login page with a selected member id.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function selectLoginId(event){
    event.preventDefault()
    const memberId = memberSelect.value
    if(!memberId?.length)
        return
    window.location = `/login/${memberId}`
}
/**
 * Submits a challenge response to the server.
 * @public
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function submitChallenge(event){
	event.preventDefault()
    event.stopPropagation()
    const { id, value: passphrase, } = memberChallenge
    if(!passphrase.trim().length)
        return
    hide(memberChallengeSubmit)
	const _mbr_id = window.location.pathname.split('/')[window.location.pathname.split('/').length-1]
	const url = window.location.origin+`/challenge/${_mbr_id}`
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ passphrase, }),
	}
	const validatePassphrase = await mSubmitPassphrase(url, options)
	if(validatePassphrase)
        location.href = '/members'
    else {
        memberChallengeError.innerHTML = 'Invalid passphrase: please try again and remember that passphrases are case sensitive.';
        memberChallenge.value = null
        memberChallenge.placeholder = 'Try your passphrase again...'
        memberChallenge.focus()
    }
}
/* private functions */
/**
 * Adds a message to the chat column.
 * @private
 * @param {object|string} message - The message to add to the chat column.
 * @param {object} options - The options for the chat bubble.
 * @returns`{void}
 */
function mAddMessage(message, options={
	bubbleClass: 'agent-bubble',
	typewrite: true,
	delay: 15,
}){
    let messageContent = message.message ?? message
    const originalMessage = messageContent
	const {
		bubbleClass,
		delay,
		typewrite,
	} = options
	const chatBubble = document.createElement('div')
	chatBubble.id = `chat-bubble-${mChatBubbleCount}`
	chatBubble.className = `chat-bubble ${bubbleClass}`
	mChatBubbleCount++
	chatSystem.appendChild(chatBubble)
	messageContent = escapeHtml(messageContent)
	if(typewrite){
		let i = 0
		let tempMessage = ''
		function _typeAgentMessage() {
			if (i <= originalMessage.length ?? 0) {
				tempMessage += originalMessage.charAt(i)
				chatBubble.innerHTML = ''
				chatBubble.insertAdjacentHTML('beforeend', tempMessage)
				i++
				setTimeout(_typeAgentMessage, delay) // Adjust the typing speed here (50ms)
				scrollToBottom()
			} else {
				chatBubble.setAttribute('status', 'done')
			}
		}
		_typeAgentMessage()
	} else {
		chatBubble.insertAdjacentHTML('beforeend', originalMessage)
		scrollToBottom()
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
    let userMessage = chatInput.value.trim()
    if (!userMessage.length) return
    userMessage = escapeHtml(userMessage) // Escape the user message
    mSubmitInput(event, userMessage)
    mAddMessage({ message: userMessage }, {
        bubbleClass: 'user-bubble',
        delay: 7,
    })
}
/**
 * Initializes event listeners.
 * @private
 * @param {boolean} specializedPage - A flag to determine if the page is specialized.
 * @returns {void}
 */
function mInitializeListeners(specializedPage=false){
    if(specializedPage){
        if(memberSelect)
            memberSelect.addEventListener('change', selectLoginId)
        if(memberChallenge){
            memberChallenge.addEventListener('input', mToggleButton)
            memberChallengeSubmit.addEventListener('click', submitChallenge)
        }
    } else {
        chatInput.addEventListener('input', toggleInputTextarea)
        chatSubmit.addEventListener('click', mAddUserMessage)
    }
}
// Function to focus on the textarea and move cursor to the end
function focusAndSetCursor(textarea) {
    textarea.focus();
    // Move the cursor to the end of the text
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
}
function getTextWidth(text, font) {
    // Create a temporary canvas element to measure text width
    let canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    let context = canvas.getContext("2d");
    context.font = font;
    return context.measureText(text).width;
}
// Function to replace an element (input/textarea) with a specified type
function replaceElement(element, newType){
    const newElement = document.createElement(newType);
    newElement.id = element.id;
    newElement.name = element.name;
    newElement.required = element.required;
    newElement.classList = element.classList;
    newElement.value = element.value;
    if (newType === 'textarea') {
        newElement.setAttribute('rows', '3');
    }
    newElement.addEventListener('input', toggleInputTextarea); // Reattach the event listener
    chatUser.replaceChild(newElement, element);
    return newElement;
}
function resetAnimation(element) {
    element.style.animation = 'none';
    // Trigger a reflow to restart the animation
    element.offsetHeight;
    element.style.animation = '';
}
function scrollToBottom() {
    chatSystem.scrollTop = chatSystem.scrollHeight;
}
/**
 * Display the entire page.
 * @private
 * @returns {void}
 */
function mShowPage(){
    const proceduralPage = memberChallenge ?? memberSelect ? true : false
    /* assign listeners */
    mInitializeListeners(proceduralPage)
    /* display elements */
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
    if(proceduralPage)
        return
    chatInput.value = null
    chatInput.placeholder = mPlaceholder
    show(chatSystem)
    show(chatContainer)
    show(chatUser)
    /* welcome-01 */
    mAddMessage({
        message: mGreeting[0],
    })
    /* welcome-02 */
    setTimeout(() => { // Set a timeout for 1 second to wait for the first line to be fully painted
        // Set another timeout for 7.5 seconds to add the second message
        const timerId = setTimeout(_addIntroductionMessage, 7500);
        // Event listeners for member interactions
        window.addEventListener('mousemove', _addIntroductionMessage, { once: true })
        window.addEventListener('click', _addIntroductionMessage, { once: true })
        window.addEventListener('focus', _addIntroductionMessage, { once: true })
        window.addEventListener('scroll', _addIntroductionMessage, { once: true })
        /* local timeout functions */
        function _addIntroductionMessage() { // Clear the 7.5 seconds timeout if any event is triggered
            clearTimeout(timerId)
            mAddMessage({ message: mGreeting[1] })
            _cleanupListeners()
            // display chat lane with placeholder
        }
        // Cleanup function to remove event listeners
        function _cleanupListeners() {
            window.removeEventListener('mousemove', _addIntroductionMessage)
            window.removeEventListener('click', _addIntroductionMessage)
            window.removeEventListener('focus', _addIntroductionMessage)
            window.removeEventListener('scroll', _addIntroductionMessage)
    }
    }, 1000)
}
/**
 * 
 * @param {Event} event 
 * @param {string} _message 
 */
async function mSubmitInput(event, _message){
	event.preventDefault()
	const url = window.location.origin
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ message: _message, role: 'user', thread_id: threadId }),
	}
    hide(chatUser)
    show(awaitButton)
	const _gptChat = await submitChat(url, options)
	// now returns array of messages
	_gptChat.forEach(gptMessage=>{
		threadId = gptMessage.thread_id
		mAddMessage({
			message: gptMessage.message,
			delay: 10,
		});
	});
    hide(awaitButton)
    chatInput.value = null
    chatInput.placeholder = mPlaceholder
    show(chatUser)
}
async function submitChat(url, options) {
	try {
		const response = await fetch(url, options)
		const jsonResponse = await response.json()
		return jsonResponse
	} catch (err) {
		console.log('fatal error', err)
		return alert(`Error: ${err.message}`)
	}
}
/**
 * 
 * @param {string} url - The url to submit the passphrase to.
 * @param {object} options - The options for the fetch request.
 * @returns {object} - The response from the server.
 */
async function mSubmitPassphrase(url, options) {
	try {
		const response = await fetch(url, options)
		const jsonResponse = await response.json()
		return jsonResponse
	} catch (err) {
		console.log('fatal error', err)
		return false
	}
}
function toggleInputTextarea(event) {
    const inputStyle = window.getComputedStyle(chatUser);
    const inputFont = inputStyle.font;
    const textWidth = getTextWidth(chatInput.value, inputFont); // no trim required
    const inputWidth = chatUser.offsetWidth;
	/* pulse */
	clearTimeout(typingTimer);
    agentSpinner.style.display = 'none';
    resetAnimation(agentSpinner); // Reset animation
    typingTimer = setTimeout(() => {
        agentSpinner.style.display = 'block';
        resetAnimation(agentSpinner); // Restart animation
    }, 2000);
    if(textWidth > inputWidth && chatInput.tagName !== 'TEXTAREA'){ // Expand to textarea
        chatInput = replaceElement(chatInput, 'textarea');
        focusAndSetCursor(chatInput);
    } else if(textWidth <= inputWidth && chatInput.tagName === 'TEXTAREA' ){ // Revert to input
		chatInput = replaceElement(chatInput, 'input');
        focusAndSetCursor(chatInput);
    }
	mToggleButton(event)
}
/**
 * Toggles the disabled state of a button based on the input element value.
 * @private
 * @param {Event} event - The input element to check.
 * @returns {void}
 */
function mToggleButton(event){
    const { id, value,} = event.target
    const input = value.trim().length ? true : false
    const buttonElement = id === 'member-challenge-input-text'
        ? memberChallengeSubmit
        : chatSubmit
    if(input){
        buttonElement.disabled = false
        buttonElement.style.cursor = 'pointer'
        show(buttonElement)
    } else {
        buttonElement.disabled = true
        buttonElement.style.cursor = 'not-allowed'
    }
}
/* exports */
export {
    escapeHtml,
    selectLoginId,
}