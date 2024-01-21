document.addEventListener('DOMContentLoaded', () => {
    /* vars */
    _awaitButton = document.getElementById('await-button')
    _agentSpinner = document.getElementById('agent-spinner')
    _botBar = document.getElementById('bot-bar')
    _chatInput = document.getElementById('chat-input')
    _chatLabel = document.getElementById('user-chat-label')
    _chatOutput = document.getElementById('chat-output')
    _messageInput = document.getElementById('user-chat-message')
    _submitButton = document.getElementById('submit-button')
    /* page listeners */
    _botBar.addEventListener('mouseover', () => {
        _botBar.style.maxHeight = '100px' // Adjust as per actual height
    })
    _botBar.addEventListener('mouseleave', () => {
        _botBar.style.maxHeight = '0'
    })
    _messageInput.addEventListener('input', toggleInputTextarea);
    _submitButton.addEventListener('click', addUserMessage); // Event listener to submit message
    document.querySelectorAll('.bot-container').forEach(container => { // Event listener to toggle bot containers
        container.addEventListener('click', function() {
            // First, close any currently open containers
            document.querySelectorAll('.bot-container .bot-content.visible').forEach(openContainer => {
                if (openContainer.parentElement !== this) { // Check to avoid closing the current container
                    openContainer.classList.remove('visible')
                }
            });
            // Then, toggle the visibility of the clicked container's content
            var content = this.querySelector('.bot-content')
            if(content?.length) content.classList.toggle('visible')
        })
    })
    /* onLoad */
    _awaitButton.style.display = 'none'
    /* page-greeting */
    _greeting.forEach(_greet=>{
        _chatBubbleCount++
        addMessageToColumn({
            message: _greet,
            chatBubbleCount: _chatBubbleCount,
        })
    })
    fetchBots()
        .then(_botFetch => { // receive processed bots, minus PA, but PA designated onSession
            const { mbr_id, thread_id: _thread_id, bots: _bots, activeBotId: _bot_id } = _botFetch
            const __activeBot = _bots.find(_bot => _bot.id === _botFetch.activeBotId)
            if(!__activeBot){
                // create PA
                _activeBot = {
                    being: 'bot',
                    bot_name: 'Personal Assistant (PA)',
                    description: 'I am  Personal Assistant (PA) is here to help you with any questions you may have.',
                    id: _bot_id,
                    mbr_id: mbr_id,
                    name: `bot-personal-avatar-${mbr_id}`,
                    purpose: 'I am  Personal Assistant (PA) is here to help you with any questions you may have.',
                    thread_id: _thread_id,
                    type: 'personal-avatar'
                }
            } else {
                _activeBot = __activeBot
            }
            // both use _page_ variables
            updateBotContainers(_bots, _activeBot)
            updateBotBar(_bots, _activeBot)
            botGreeting(_activeBot.greeting??_activeBot.description??_activeBot.purpose)
        })
        .catch(err => {
            console.log('Error fetching bots:', err)
            // alert(`Error fetching bots. Please try again later. ${err.message}`)
        })
})
/* page chat vars */
/* define variables */
const _greeting = [`So nice to see you!`]
let _activeBot // replaced with _pagebots[reference]
let _chatBubbleCount = 0
let _pageBots = [] // send for processing
let typingTimer
/* page div vars */
let _awaitButton
let _agentSpinner
let _botBar
let _chatInput
let _chatLabel
let _chatOutput
let _messageInput
let _submitButton
/* page functions */
function addMessageToColumn(_message, _options={
	bubbleClass: 'agent-bubble',
	_delay: 15,
    _chatBubbleCount: 0,
	_typewrite: true,
}){
	const {
		category=null,
		contributions=[],
		id=null,
		message,
		question=null
	} = _message
	const {
		bubbleClass,
		_delay,
        _chatBubbleCount,
		_typewrite,
	} = _options
	const chatBubble = document.createElement('div')
	chatBubble.setAttribute('id', `chat-bubble-${_chatBubbleCount}`)
	chatBubble.className = `chat-bubble ${bubbleClass}`
	_chatOutput.appendChild(chatBubble)
	_message = escapeHtml(message)
	if (_typewrite) {
		let i = 0;
		let tempMessage = '';
		function typeAgentMessage() {
			if (i < message.length) {
				tempMessage += message.charAt(i);
				chatBubble.innerHTML = '';
				chatBubble.insertAdjacentHTML('beforeend', tempMessage);
				i++;
				setTimeout(typeAgentMessage, _delay); // Adjust the typing speed here (50ms)
			} else {
				chatBubble.setAttribute('status', 'done');
			}
		}
		typeAgentMessage();
	} else {
		chatBubble.insertAdjacentHTML('beforeend', message);
	}
}
function addUserMessage(_event){
    _event.preventDefault()
    // Dynamically get the current message element (input or textarea)
    let userMessage = __messageInput.value.trim()
    if (!userMessage.length) return
    userMessage = escapeHtml(userMessage) // Escape the user message
    submit(_event, userMessage)
    addMessageToColumn({ message: userMessage }, {
        bubbleClass: 'user-bubble',
        _delay: 7,
    })
    _messageInput.value = ''; // Clear the message field
}
// Function to escape HTML special characters
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
// Function to focus on the textarea and move cursor to the end
function focusAndSetCursor(textarea) {
    textarea.focus();
    // Move the cursor to the end of the text
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
}
function getActiveCategory() {
	return _activeCategory;
}
function getTextWidth(text, font) {
    // Create a temporary canvas element to measure text width
    let canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    let context = canvas.getContext("2d");
    context.font = font;
    return context.measureText(text).width;
}
// Function to replace an element (input/textarea) with a specified type
function replaceElement(element, newType) {
    const newElement = document.createElement(newType);
    newElement.id = element.id;
    newElement.name = element.name;
    newElement.required = element.required;
    newElement.classList = element.classList;
    newElement.value = element.value;
    if (newType === 'textarea') {
        newElement.setAttribute('rows', '3');
    }
    element.parentNode.replaceChild(newElement, element);
    newElement.addEventListener('input', toggleInputTextarea); // Reattach the event listener
    return newElement;
}
function resetAnimation(element) {
    element.style.animation = 'none';
    // Trigger a reflow to restart the animation
    element.offsetHeight;
    element.style.animation = '';
}
function scrollToBottom() {
    _chatOutput.scrollTop = _chatOutput.scrollHeight;
}
function setActiveBot(botId, thread_id) {
    _activeBot.id = botId
    _activeBot.thread_id = thread_id
    /* set bot-bar */
    bots.forEach(bot => {
        const icon = document.createElement('img');
        icon.src = bot.iconUrl; // Assuming each bot has an icon URL
        icon.classList.add('bot-icon');
        icon.dataset.botId = bot.id;
        botBar.appendChild(icon);
    })
}
async function setActiveCategory(category, contributionId, question) {
    const url = '/members/category'; // Replace with your server's URL
    const data = {
        contributionId: contributionId,
        category: category,
        question: question
    };
    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
		.then(_response => {
			if (!_response.ok) {
				throw new Error(`HTTP error! Status: ${_response.status}`);
			}
			return _response.json();
		})
		.then(_response => {
			_activeCategory = {
				contributionId: _response.contributionId,
				category: _response.category,
			}
		})
		.catch(err => {
			console.log('Error setting active category:', err);
			// Handle errors as needed
		});
}
async function submit(_event, _message) {
	_event.preventDefault()
	if(!_message.length??false)
		throw new Error('submit(): `message` property is required')
	_submitButton.style.display = 'none';
	_awaitButton.style.display = 'block';
	_agentSpinner.classList.remove('text-light');
	_agentSpinner.classList.add('text-primary');
	const url = window.location.origin + '/members';
	const _request = {
			agent: 'member',
			id: null,
			message: _message,
		}
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(_request),	//	todo: pull json schema for this object from `/messages/$defs/message_member_chat`
	};
	const _MyLifeResponseArray = await submitChat(url, options);
	_MyLifeResponseArray.forEach(_MyLifeResponse => {
		addMessageToColumn({ message: _MyLifeResponse.message })
	});
	_awaitButton.style.display = 'none';
	_submitButton.style.display = 'block';
	_agentSpinner.classList.remove('text-primary');
	_agentSpinner.classList.add('text-light');
}
async function submitChat(url, options) {
	try {
		const response = await fetch(url, options);
		const jsonResponse = await response.json();
		return jsonResponse;
	} catch (err) {
		console.log('fatal error', err);
		return alert(`Error: ${err.message}`);
	}
}
// Function to toggle between textarea and input based on character count
function toggleInputTextarea() {
    const inputStyle = window.getComputedStyle(chatInput);
    const inputFont = inputStyle.font;
    const textWidth = getTextWidth(_messageInput.value, inputFont); // no trim required
    const inputWidth = chatInput.offsetWidth;
	/* pulse */
	clearTimeout(typingTimer);
    _agentSpinner.style.display = 'none';
    resetAnimation(_agentSpinner); // Reset animation
    typingTimer = setTimeout(() => {
        _agentSpinner.style.display = 'block';
        resetAnimation(_agentSpinner); // Restart animation
    }, 2000);

    if (textWidth > inputWidth && _messageInput.tagName !== 'TEXTAREA') { // Expand to textarea
        _messageInput = replaceElement(_messageInput, 'textarea');
        focusAndSetCursor(_messageInput);
    } else if (textWidth <= inputWidth && _messageInput.tagName === 'TEXTAREA' ) { // Revert to input
		_messageInput = replaceElement(_messageInput, 'input');
        focusAndSetCursor(_messageInput);
    }
	toggleSubmitButtonState();
}
function toggleSubmitButtonState() {
	_submitButton.disabled = !_messageInput.value?.trim()?.length??true;
}