/* bot functionality */
/* imports */
import {
    addInput,
    addMessage,
    addMessages,
    decorateActiveBot,
    experiences,
    expunge,
    fetchSummary,
    getActiveItemId,
    hide,
    obscure,
    seedInput,
    setActiveItem,
    setActiveItemTitle,
    show,
    startExperience,
    submit,
    toggleMemberInput,
    toggleVisibility,
    unsetActiveItem,
} from './members.mjs'
import Globals from './globals.mjs'
const mAvailableCollections = ['entry', 'experience', 'file', 'story'], // ['chat', 'conversation'],
    mAvailableMimeTypes = [],
    mAvailableUploaderTypes = ['collections', 'personal-avatar'],
    botBar = document.getElementById('bot-bar'),
    mCollections = document.getElementById('collections-collections'),
    mCollectionsContainer = document.getElementById('collections-container'),
    mCollectionsUpload = document.getElementById('collections-upload'),
    mDefaultReliveMemoryButtonText = 'next',
    mDefaultTeam = 'memory',
    mGlobals = new Globals(),
    passphraseCancelButton = document.getElementById(`personal-avatar-passphrase-cancel`),
    passphraseInput = document.getElementById(`personal-avatar-passphrase`),
    passphraseInputContainer = document.getElementById(`personal-avatar-passphrase-container`),
    passphraseResetButton = document.getElementById(`passphrase-reset-button`),
    passphraseSubmitButton = document.getElementById(`personal-avatar-passphrase-submit`),
    mTeamAddMemberIcon = document.getElementById('add-team-member-icon'),
    mTeamHeader = document.getElementById('team-header'),
    mTeamName = document.getElementById('team-name'),
    mTeamPopup = document.getElementById('team-popup'),
    mTeams = []
/* variables */
let mActiveBot,
    mActiveTeam,
    mBots,
    mShadows
/* onDomContentLoaded */
document.addEventListener('DOMContentLoaded', async event=>{
    mShadows = await mGlobals.fetchShadows()
    const { bots, activeBotId: id } = await fetchBots()
    if(!bots?.length)
        throw new Error(`ERROR: No bots returned from server`)
    updatePageBots(bots) // includes p-a
    await setActiveBot(id, true)
})
/* public functions */
/**
 * Get active bot.
 * @public
 * @returns {object} - The active bot object.
 */
function activeBot(){
    return mActiveBot
}
/**
 * Fetch bots from server, used primarily for initialization of page, though could be requested on-demand.
 * @public
 * @returns {Promise<Object[Array]>} - The bot object array, no wrapper.
 */
async function fetchBots(){
    const url = window.location.origin + '/members/bots'
    const response = await fetch(url)
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    return await response.json()
}
/**
 * Fetch collection(s) requested on-demand.
 * @param {string} type - The type of collections to fetch.
 * @returns {Promise<Object[Array]>} - The collection(s)' items, no wrapper.
 */
async function fetchCollections(type){
    const url = window.location.origin
        + `/members/collections`
        + ( !type ? '' : `/${ type }` )
    let response = await fetch(url)
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    response = await response.json()
    return response
}
async function fetchTeam(teamId){
    const url = window.location.origin + '/members/teams/' + teamId
    const method = 'POST'
    const response = await fetch(url, { method, })
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    return await response.json()
}
/**
 * Fetch MyLife Teams from server.
 * @returns {Object[Array]} - The list of available team objects.
 */
async function fetchTeams(){
    const url = window.location.origin + '/members/teams'
    const response = await fetch(url)
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    return await response.json()
}
/**
 * Get specific bot by id (first) or type.
 * @param {string} type - The bot type, optional.
 * @param {Guid} id - The bot id, optional.
 * @returns {object} - The bot object.
 */
function getBot(type='personal-avatar', id){
    return mBot(id ?? type)
}
/**
 * Get collection item by id.
 * @param {Guid} id - The collection item id.
 * @returns {object} - The collection item object.
 */
function getItem(id){
    /* return collection elements by id */

}
/**
 * Refresh designated collection from server. **note**: external calls denied option to identify collectionList parameter, ergo must always be of same type.
 * @param {string} type - The collection type.
 * @returns {void}
 */
async function refreshCollection(type){
    return await mRefreshCollection(type)
}
/**
 * Set active bot on server and update page bots.
 * @requires mActiveBot
 * @requires mBots
 * @param {Event} event - The event object.
 * @param {boolean} dynamic - Whether or not to add dynamic greeting, only triggered from source code.
 * @returns {void}
 */
async function setActiveBot(event, dynamic=false){
    const botId = mGlobals.isGuid(event)
        ? event /* bypassed event, sent id */
        : event.target?.dataset?.bot_id
    if(!botId)
        throw new Error(`Bot data not found in event.`)
    const initialActiveBot = mActiveBot
    mActiveBot = mBot(botId)
        ?? initialActiveBot
    if(!mActiveBot)
        throw new Error(`ERROR: failure to set active bot.`)
    if(initialActiveBot===mActiveBot)
        return // no change, no problem
    const { id, type, } = mActiveBot
    /* confirm via server request: set active bot */
    const serverResponse = await fetch(
        '/members/bots/activate/' + id,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response=>{
            if(!response.ok){
                throw new Error(`HTTP error! Status: ${response.status}`)
            }
            return response.json()
        })
        .catch(error=>{
            addMessage(`Server error setting active bot: ${ error.message }`)
            return
        })
    /* update active bot */
    const { activeBotId, activeBotVersion, version, } = serverResponse
    if(activeBotId!==id){
        mActiveBot = initialActiveBot
        addMessage('Server error setting active bot.')
    }
    /* update page bot data */
    const { activated=[], activatedFirst=Date.now(), } = mActiveBot
    mActiveBot.activatedFirst = activatedFirst
    activated.push(Date.now()) // newest date is last to .pop()
    // dynamic = (Date.now()-activated.pop()) > (20*60*1000)
    mActiveBot.activated = activated
    if(activeBotVersion!==version){
        const botVersion = document.getElementById(`${ type }-title-version`)
        if(botVersion){
            botVersion.classList.add('update-available')
            botVersion.dataset.botId = activeBotId
            botVersion.dataset.currentVersion = activeBotVersion
            botVersion.dataset.type = type
            botVersion.dataset.updateVersion = version
            botVersion.addEventListener('click', mUpdateBotVersion, { once: true })
        }
    }
    /* update page */
    mSpotlightBotBar()
    mSpotlightBotStatus()
    mGreeting(dynamic)
    decorateActiveBot(mActiveBot)
}
/**
 * Exposed method to allow externalities to toggle a specific item popup.
 * @param {string} id - Id for HTML div element to toggle.
 */
function togglePopup(id, bForceState=null){
    const popup = document.getElementById(id)
    if(!popup)
        throw new Error(`No popup found for id: ${ id }`)
    toggleVisibility(popup, bForceState)
}
/**
 * Update collection item title.
 * @todo - Only update local memory and data(sets), not full local refresh
 * @param {object} item - The collection item fields to update, requires `{ itemId, }`
 * @returns {void}
 */
function updateItem(item){
    if(!item?.itemId)
        throw new Error(`No item provided to update.`)
    /* update collection elements indicated as object keys with this itemId */
    // @stub - force-refresh memories; could be more savvy
    refreshCollection('story')
}
/**
 * Proxy to update bot-bar, bot-containers, and bot-greeting, if desired. Requirements should come from including module, here `members.mjs`.
 * @public
 * @requires mBots
 * @param {Array} bots - The bot objects to update page with.
 * @param {boolean} includeGreeting - Include bot-greeting.
 * @returns {void}
 */
async function updatePageBots(bots=mBots, includeGreeting=false, dynamic=false){
    if(!bots?.length)
        throw new Error(`No bots provided to update page.`)
    if(mBots!==bots)
        mBots = bots
    await mUpdateTeams()
    await mUpdateBotContainers()
    // mUpdateBotBar()
    if(includeGreeting)
        mGreeting(dynamic)
}
/* private functions */
/**
 * Find bot in mBots by id.
 * @requires mBots
 * @param {string} type - The bot type or id.
 * @returns {object} - The bot object.
 */
function mBot(type){
    return mBots.find(bot=>bot.type===type)
        ?? mBots.find(bot=>bot.id===type)
}
/**
 * Check if bot is active (by id).
 * @param {Guid} id - The bot id to check.
 * @returns 
 */
function mBotActive(id){
    return id===mActiveBot?.id
        ?? false
}
/**
 * Request version update to bot.
 * @param {Guid} botId - The bot id to update
 * @returns {object} - Response from server { bot, success, }
 */
async function mBotVersionUpdate(botId){
    const url = window.location.origin + '/members/bots/version/' + botId
    const method = 'PUT'
    const response = await fetch(url, { method, })
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    return await response.json()
}
/**
 * Request bot be created on server.
 * @requires mActiveTeam
 * @param {string} type - bot type
 * @returns {object} - bot object from server.
 */
async function mCreateBot(type){
    const { id: teamId, } = mActiveTeam
    const url = window.location.origin + '/members/bots/create'
    const method = 'POST'
    const body = JSON.stringify({ teamId, type, })
    const headers = { 'Content-Type': 'application/json' }
    let response = await fetch(url, { body, headers, method, })
    if(!response.ok)
        throw new Error(`server unable to create bot.`)
    response = await response.json()
    return response
}
/**
 * Returns icon path string based on bot type.
 * @param {string} type - bot type
 * @returns {string} icon path
 */
function mBotIcon(type){
    let image = 'png/'
    switch(type){
        case 'art':
            image+='art-thumb.png'
            break
        case 'avatar':
        case 'personal-avatar':
            image+='personal-avatar-thumb-02.png'
            break
        case 'diary':
        case 'diarist':
            image+='diary-thumb.png'
            break
        case 'journal':
        case 'journaler':
            image+='journal-thumb.png'
            break
        case 'education':
            image+='education-thumb.png'
            break
        case 'health':
            image+='health-thumb.png'
            break
        case 'library':
            image+='library-thumb.png'
            break
        case 'personal-biographer':
        case 'biographer':
            image+='biographer-thumb.png'
            break
        case 'resume':
            image+='resume-thumb.png'
            break
        case 'ubi':
            image+='ubi-thumb.png'
            break
        default:
            image+='work-thumb.png'
            break
    }
    return image
}
/**
 * Create a functional collection item HTML div for the specified collection type.
 * @example - collectionItem: { assistantType, filename, form, id, keywords, name, summary, title, type, }
 * @param {object} collectionItem - The collection item object, requires type.
 * @returns {HTMLDivElement} - The collection item.
 */
function mCreateCollectionItem(collectionItem){
    /* collection item container */
    const { assistantType, filename, form, id, name, title, type, } = collectionItem
    const iconType = assistantType
        ?? form
        ?? type
    const item = document.createElement('div')
    item.id = `collection-item_${ id }`
    item.name = `collection-item-${ type }`
    item.classList.add('collection-item', `${ type }-collection-item`)
    /* icon */
    const itemIcon = document.createElement('img')
    itemIcon.id = `collection-item-icon_${ id }`
    itemIcon.name = `collection-item-icon-${ type }`
    itemIcon.classList.add('collection-item-icon', `${ type }-collection-item-icon`)
    itemIcon.src = mBotIcon(iconType)
    item.appendChild(itemIcon)
    /* name */
    const itemName = document.createElement('span')
    itemName.id = `collection-item-name_${ id }`
    itemName.name = `collection-item-name-${ type }`
    itemName.classList.add('collection-item-name', `${ type }-collection-item-name`)
    itemName.innerText = title
        ?? name
        ?? filename
        ?? `unknown ${ type } item`
    item.appendChild(itemName)
    /* buttons */
    switch(type){
        case 'file':
            /* file-summary icon */
            const itemSummary = mCreateCollectionItemSummarize(type, id, filename)
            item.appendChild(itemSummary)
            break
        default:
            const itemDelete = mCreateCollectionItemDelete(type, id)
            item.appendChild(itemDelete)
            break
    }
    /* popup */
    switch(type){
        case 'file':
            /* file-summary popup */
            break
        default:
            const itemPopup = mCreateCollectionPopup(collectionItem)
            item.appendChild(itemPopup)
            item.addEventListener('click', mTogglePopup)
            item.addEventListener('dblclick', mUpdateCollectionItemTitle, { once: true })
            break
    }
    return item
}
/**
 * Create a collection item delete button.
 * @param {string} type - The collection type.
 * @param {Guid} id - The collection id.
 * @returns {HTMLSpanElement} - The collection item delete button.
 */
function mCreateCollectionItemDelete(type, id){
    const itemDelete = document.createElement('span')
    itemDelete.id = `collection-item-delete_${ id }`
    itemDelete.name = `collection-item-delete-${ type }`
    itemDelete.classList.add('fas', 'fa-trash', 'collection-item-delete', `${ type }-collection-item-delete`)
    itemDelete.addEventListener('click', mDeleteCollectionItem, { once: true })
    return itemDelete
}
function mCreateCollectionItemSummarize(type, id, name){
    const itemSummarize = document.createElement('span')
    itemSummarize.classList.add('fas', 'fa-file-circle-question', 'collection-item-summary', `${ type }-collection-item-summary`)
    itemSummarize.dataset.fileId = id /* raw openai file id */
    itemSummarize.dataset.fileName = name
    itemSummarize.dataset.id= `collection-item-summary-${ id }`
    itemSummarize.dataset.type = type
    itemSummarize.id = itemSummarize.dataset.id
    itemSummarize.name = `collection-item-summary-${ type }`
    itemSummarize.addEventListener('click', mSummarize, { once: true })
    return itemSummarize
}
/**
 * A memory shadow is a scrolling text members can click to get background (to include) or create content to bolster the memory. Goes directly to chat, and should minimize, or close for now, the story/memory popup.
 * @requires mShadows
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mMemoryShadow(event){
    event.stopPropagation()
    const { itemId, lastResponse, shadowId, } = this.dataset
    const shadow = mShadows.find(shadow=>shadow.id===shadowId)
    if(!shadow)
        return
    const { categories, id, text, type, } = shadow // type enum: [agent, member]
    switch(type){
        case 'agent': /* agent shadows go directly to server for answer */
            addMessage(text, { role: 'member', })
            const response = await submit(text) /* proxy submission, use endpoint: /shadow */
            const { error, errors: _errors, itemId: responseItemId, messages, processingBotId, success=false, } = response
            const errors = error?.length ? [error] : _errors
            if(!success || !messages?.length)
                throw new Error(`No response from server for shadow request.`)
            const botId = processingBotId
                ?? messages[0].activeBotId
                ?? mActiveBot?.id
            if(mActiveBot?.id===botId)
                setActiveBot(botId)
            this.dataset.lastResponse = JSON.stringify(messages)
            addMessages(messages) // print to screen
            break
        case 'member': /* member shadows populate main chat input */
            const seedText = text.replace(/(\.\.\.|…)\s*$/, '').trim() + ' '
            seedInput(itemId, shadowId, seedText, text)
            break
        default:
            throw new Error(`Unimplemented shadow type: ${ type }`)
    }
    /* close popup */
    const popupClose = document.getElementById(`popup-close_${ itemId }`)
    if(popupClose)
        popupClose.click()
}
/**
 * Processes a document summary request.
 * @this - collection-item-summary (HTMLSpanElement)
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSummarize(event){
    event.preventDefault()
    event.stopPropagation()
    const { dataset, } = this
    console.log('mSummarize::dataset', dataset, this)
    if(!dataset)
        throw new Error(`No dataset found for summary request.`)
    const { fileId, fileName, type, } = dataset
    if(type!=='file')
        throw new Error(`Unimplemented type for summary request.`)
    /* visibility triggers */
    this.classList.remove('summarize-error', 'fa-file-circle-exclamation', 'fa-file-circle-question', 'fa-file-circle-xmark')
    this.classList.add('fa-compass', 'spin')
    /* fetch summary */
    const { instruction, responses, success, } = await fetchSummary(fileId, fileName) // throws on console.error
    /* visibility triggers */
    this.classList.remove('fa-compass', 'spin')
    if(success)
        this.classList.add('fa-file-circle-xmark')
    else
        this.classList.add('fa-file-circle-exclamation', 'summarize-error')
    /* print response */
    if(instruction?.length)
        console.log('mSummarize::instruction', instruction)
    addMessages(responses)
    setTimeout(_=>{
        this.addEventListener('click', mSummarize, { once: true })
        this.classList.add('fa-file-circle-question')
        this.classList.remove('summarize-error', 'fa-file-circle-exclamation', 'fa-file-circle-xmark', 'fa-compass') // jic
        show(this)
    }, 20*60*1000)
}
/**
 * Closes the team popup.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mCloseTeamPopup(event){
    event.preventDefault()
    event.stopPropagation()
    const { ctrlKey, key, target, } = event
    if((key && key!='Escape') && !(ctrlKey && key=='w'))
        return
    document.removeEventListener('keydown', mCloseTeamPopup)
    hide(mTeamPopup)
}
/**
 * Creates bot thumb container.
 * @param {object} bot - The bot object, defaults to personal-avatar.
 * @returns {HTMLDivElement} - The bot thumb container.
 */
function mCreateBotThumb(bot=getBot()){
    const { id, name, type, } = bot
    /* bot-thumb container */
    const botThumbContainer = document.createElement('div')
    botThumbContainer.id = `bot-bar-container_${ id }`
    botThumbContainer.name = `bot-bar-container-${ type }`
    botThumbContainer.title = name
    botThumbContainer.addEventListener('click', setActiveBot)
    botThumbContainer.classList.add('bot-thumb-container')
    /* bot-thumb */
    const botIconImage = document.createElement('img')
    botIconImage.classList.add('bot-thumb')
    botIconImage.src = mBotIcon(type)
    botIconImage.alt = type
    botIconImage.id = `bot-bar-icon_${ id }`
    botIconImage.dataset.bot_id = id
    botThumbContainer.appendChild(botIconImage)
    return botThumbContainer
}
/**
 * Create a popup for viewing collection item.
 * @param {object} collectionItem - The collection item object.
 * @returns {HTMLDivElement} - The collection popup.
 */
function mCreateCollectionPopup(collectionItem){
    const { form, id, name, summary, title, type } = collectionItem
    const collectionPopup = document.createElement('div')
    collectionPopup.classList.add('collection-popup', 'popup-container')
    collectionPopup.dataset.active = 'false'
    collectionPopup.dataset.id = id
    collectionPopup.dataset.title = title
    collectionPopup.dataset.type = type
    collectionPopup.id = `popup-container_${ id }`
    collectionPopup.name = `collection-popup_${ type }`
    collectionPopup.addEventListener('click', (e)=>e.stopPropagation()) /* Prevent event bubbling to collection-bar */
    /* popup header */
    const popupHeader = document.createElement('div')
    popupHeader.classList.add('popup-header', 'collection-popup-header')
    popupHeader.id = `popup-header_${ id }`
    popupHeader.innerText = title ?? `${ type } Item`
    /* Variables for dragging */
    let isDragging = false
    let offsetX, offsetY
    /* Mouse down event to initiate drag */
    popupHeader.addEventListener('mousedown', (e)=>{
        isDragging = true
        offsetX = e.clientX - collectionPopup.offsetLeft
        offsetY = e.clientY - collectionPopup.offsetTop
        e.stopPropagation()
    })
    /* Mouse move event to drag the element */
    popupHeader.addEventListener('mousemove', (e)=>{
        if(isDragging){
            collectionPopup.style.left = `${e.clientX - offsetX}px`
            collectionPopup.style.position = 'absolute'
            collectionPopup.style.top = `${e.clientY - offsetY}px`
        }
    })
    /* Mouse up event to end drag */
    popupHeader.addEventListener('mouseup', ()=>{
        isDragging = false
        collectionPopup.dataset.offsetX = collectionPopup.offsetLeft
        collectionPopup.dataset.offsetY = collectionPopup.offsetTop
    })
    /* create popup close button */
    const popupClose = document.createElement('button')
    popupClose.classList.add('fa-solid', 'fa-close', 'popup-close', 'collection-popup-close')
    popupClose.dataset.isClose = 'true'
    popupClose.id = `popup-close_${ id }`
    popupClose.setAttribute('aria-label', 'Close')
    popupClose.addEventListener('click', mTogglePopup)
    /* create popup body/container */
    const popupBody = document.createElement('div')
    popupBody.classList.add('popup-body', 'collection-popup-body')
    popupBody.id = `popup-body_${ id }`
    popupBody.name = `popup-body-${ type }`
    /* create popup content */
    const content = summary ?? JSON.stringify(collectionItem)
    const popupContent = document.createElement('textarea')
    popupContent.classList.add('popup-content', 'collection-popup-content')
    popupContent.dataset.lastUpdatedContent = content
    popupContent.id = `popup-content_${id}`
    popupContent.readOnly = true
    popupContent.value = content
    /* create popup sidebar */
    const sidebar = document.createElement('div')
    sidebar.classList.add('popup-sidebar')
    sidebar.id = `popup-sidebar_${ id }`
    /* create edit toggle button */
    const popupEdit = document.createElement('span')
    popupEdit.classList.add('fas', 'fa-edit', 'popup-sidebar-icon')
    popupEdit.id = `popup-edit_${ id }`
    popupEdit.dataset.id = id
    popupEdit.dataset.contentId = popupContent.id
    /* create save button */
    const popupSave = document.createElement('span')
    popupSave.classList.add('fas', 'fa-save', 'popup-sidebar-icon')
    popupSave.id = `popup-save_${ id }`
    popupSave.dataset.id = id
    popupSave.dataset.contentId = popupContent.id
    popupSave.addEventListener('click', mUpdateCollectionItem)
    /* toggle-edit listeners */
    popupEdit.addEventListener('click', (event)=>{
        const { target: editIcon,} = event
        const content = document.getElementById(editIcon.dataset?.contentId)
        if(!content)
            throw new Error(`No content found for edit request.`)        
        _toggleEditable(event, false, content)
    })
    popupContent.addEventListener('dblclick', (event)=>{
        const { target: contentElement, } = event
        _toggleEditable(event, false, contentElement)
    }) /* double-click to toggle edit */
    popupContent.addEventListener('blur', (event) => {
        const { target: contentElement, } = event
        _toggleEditable(event, true, contentElement)
        // @stub - update content on server call if dynamic
    })
    popupContent.addEventListener('keydown', (event) => {
        const { target: contentElement, } = event
        if(event.key==='Escape')
            _toggleEditable(event, true, contentElement)
    })
    /* inline function to toggle editable state */
    function _toggleEditable(event, state, contentElement){
        event.stopPropagation()
        contentElement.dataset.lastCursorPosition = contentElement.selectionStart
        contentElement.readOnly = state
            ?? !contentElement.readOnly
            ?? true
        contentElement.focus()
    }
    sidebar.appendChild(popupEdit)
    sidebar.appendChild(popupSave)
    /* create emoticon bar */
    const emoticons = ['😀', '😢', '😡', '😍', '😱'] // Add more emoticons as needed
    emoticons.forEach(emoticon => {
        const emoticonButton = document.createElement('span')
        emoticonButton.classList.add('popup-sidebar-emoticon')
        emoticonButton.innerText = emoticon
        emoticonButton.addEventListener('click', (event)=>{
            event.stopPropagation()
            console.log('Emoticon:write', emoticon, popupContent.readOnly, popupContent)
            const { lastCursorPosition, } = popupContent.dataset
            const insert = ` ${ emoticon }`
            if(lastCursorPosition){
                const textBeforeCursor = popupContent.value.substring(0, lastCursorPosition)
                const textAfterCursor = popupContent.value.substring(popupContent.selectionEnd)
                popupContent.value = textBeforeCursor + insert + textAfterCursor
                popupContent.selectionStart = popupContent.selectionEnd = lastCursorPosition + emoticon.length + 1
            } else
                popupContent.value += insert
        })
        sidebar.appendChild(emoticonButton)
    })
    /* append to body */
    popupBody.appendChild(popupContent)
    popupBody.appendChild(sidebar)
    /* create type-specific elements */
    let typePopup
    switch (type) {
        case 'entry':
            // @stub - could switch on `form`
            const entryType = form
                ?? type
            /* improve entry container */
            const improveEntry = document.createElement('div')
            improveEntry.classList.add(`collection-popup-${ type }`)
            improveEntry.id = `popup-${ entryType }_${ id }`
            improveEntry.name = 'improve-entry-container'
            /* improve entry lane */
            const improveEntryLane = document.createElement('div')
            improveEntryLane.classList.add('improve-entry-lane')
            /* obscure entry */
            const obscureEntry = document.createElement('button')
            obscureEntry.classList.add('obscure-button', 'button')
            obscureEntry.dataset.id = id /* required for mObscureEntry */
            obscureEntry.id = `button-obscure-${ entryType }_${ id }`
            obscureEntry.name = 'obscure-button'
            obscureEntry.textContent = 'Obscure Entry'
            obscureEntry.addEventListener('click', mObscureEntry, { once: true })
            /* experience entry panel */
            const experienceEntry = document.createElement('div')
            experienceEntry.classList.add('experience-entry-container')
            experienceEntry.id = `experience_${ id }`
            experienceEntry.name = 'experience-entry-container'
            /* experience entry explanation */
            const experienceExplanation = document.createElement('div')
            experienceExplanation.classList.add('experience-entry-explanation')
            experienceExplanation.id = `experience-explanation_${ id }`
            experienceExplanation.name = 'experience-entry-explanation'
            experienceExplanation.textContent = 'Experience an entry by clicking the button below. Eventually, you will be able to experience the entry from multiple perspectives.'
            /* experience entry button */
            const experienceButton = document.createElement('button')
            experienceButton.classList.add('experience-entry-button', 'button')
            experienceButton.dataset.id = id /* required for triggering PATCH */
            experienceButton.id = `experience-entry-button_${ id }`
            experienceButton.name = 'experience-entry-button'
            experienceButton.textContent = 'Experience Entry'
            experienceButton.addEventListener('click', _=>{
                alert('Experience Entry: Coming soon')
            }, { once: true })
            /* memory media-carousel */
            const entryCarousel = document.createElement('div')
            entryCarousel.classList.add('media-carousel')
            entryCarousel.id = `media-carousel_${ id }`
            entryCarousel.name = 'media-carousel'
            entryCarousel.textContent = 'Coming soon: media file uploads to Enhance and Improve entries'
            /* append elements */
            experienceEntry.appendChild(experienceExplanation)
            experienceEntry.appendChild(experienceButton)
            improveEntryLane.appendChild(obscureEntry)
            improveEntryLane.appendChild(experienceEntry)
            improveEntry.appendChild(improveEntryLane)
            improveEntry.appendChild(entryCarousel)
            typePopup = improveEntry
            break
        case 'experience':
        case 'file':
            break
        case 'story': // memory
            /* improve memory container */
            const improveMemory = document.createElement('div')
            improveMemory.classList.add(`collection-popup-${ type }`)
            improveMemory.id = `popup-${ type }_${ id }`
            improveMemory.name = 'improve-memory-container'
            /* shadows, relive-memory panel */
            const improveMemoryLane = document.createElement('div')
            improveMemoryLane.classList.add('improve-memory-lane')
            /* story shadows */
            if(mShadows?.length)
                improveMemoryLane.appendChild(mCreateMemoryShadows(id))
            /* relive memory panel */
            const reliveMemory = document.createElement('div')
            reliveMemory.classList.add('relive-memory-container')
            reliveMemory.id = `relive-memory_${ id }`
            reliveMemory.name = 'relive-memory-container'
            /* relive memory explanation */
            const reliveExplanation = document.createElement('div')
            reliveExplanation.classList.add('relive-memory-explanation')
            reliveExplanation.id = `relive-memory-explanation_${ id }`
            reliveExplanation.name = 'relive-memory-explanation'
            reliveExplanation.textContent = 'Relive a memory by clicking the button below. This will bring up the memory in chat, where you can add to it, or simply enjoy reliving it!'
            /* relive memory button */
            const reliveButton = document.createElement('button')
            reliveButton.classList.add('relive-memory-button', 'button')
            reliveButton.dataset.id = id /* required for triggering PATCH */
            reliveButton.id = `relive-memory-button_${ id }`
            reliveButton.name = 'relive-memory-button'
            reliveButton.textContent = 'Relive Memory'
            reliveButton.addEventListener('click', mReliveMemory, { once: true })
            /* append elements */
            reliveMemory.appendChild(reliveExplanation)
            reliveMemory.appendChild(reliveButton)
            improveMemoryLane.appendChild(reliveMemory)
            /* memory media-carousel */
            const memoryCarousel = document.createElement('div')
            memoryCarousel.classList.add('media-carousel')
            memoryCarousel.id = `media-carousel_${ id }`
            memoryCarousel.name = 'media-carousel'
            memoryCarousel.textContent = 'Coming soon: media file uploads to Enhance and Improve memories'
            /* append elements */
            improveMemory.appendChild(improveMemoryLane)
            improveMemory.appendChild(memoryCarousel)
            typePopup = improveMemory
            break
        default:
            break
    }
    /* append elements */
    collectionPopup.appendChild(popupHeader)
    collectionPopup.appendChild(popupClose)
    collectionPopup.appendChild(popupBody)
    if(typePopup)
        collectionPopup.appendChild(typePopup)
    return collectionPopup
}
/**
 * Create a memory shadow `HTMLDivElement`.
 * @requires mShadows
 * @param {Guid} itemId - The collection item id.
 * @returns {HTMLDivElement} - The shadowbox <div>.
 */
function mCreateMemoryShadows(itemId){
    let currentIndex = Math.floor(Math.random() * mShadows.length)
    const shadow = mShadows[currentIndex]
    const shadowBox = document.createElement('div')
    shadowBox.classList.add('memory-shadow')
    shadowBox.dataset.itemId = itemId
    shadowBox.id = `memory-shadow_${ itemId }`
    shadowBox.name = 'memory-shadow'
    // @stub - add mousewheel event listener to scroll through shadows
    // shadowBox.addEventListener('wheel', _=>console.log('wheel', _.deltaMode)) // no scroll
    /* shadow vertical carousel */
    // @stub - include vertical carousel with more visible prompts, as if on a cylinder
    /* single shadow text */
    const { categories, id, text, type, } = shadow
    const shadowText = document.createElement('div')
    shadowText.classList.add('memory-shadow-text')
    shadowText.dataset.itemId = itemId
    shadowText.dataset.lastResponse = '' // array of messages, will need to stringify/parse
    shadowText.dataset.shadowId = id
    shadowText.textContent = text
    shadowText.addEventListener('click', mMemoryShadow)
    shadowBox.appendChild(shadowText)
    // @stub - add mousewheel event listener to scroll through shadows
    /* pagers */
    const shadowPagers = document.createElement('div')
    shadowPagers.classList.add('memory-shadow-pagers')
    shadowPagers.id = `memory-shadow-pagers_${ itemId }`
    /* back pager */
    const backPager = document.createElement('div')
    backPager.dataset.direction = 'back'
    backPager.id = `memory-shadow-back_${ itemId }`
    backPager.classList.add('caret', 'caret-up')
    backPager.addEventListener('click', _pager)
    /* next pager */
    const nextPager = document.createElement('div')
    nextPager.dataset.direction = 'next'
    nextPager.id = `memory-shadow-next_${ itemId }`
    nextPager.classList.add('caret', 'caret-down')
    nextPager.addEventListener('click', _pager)
    /* inline function _pager */
    function _pager(event){
        event.stopPropagation()
        const { direction, } = this.dataset
        currentIndex = direction==='next'
            ? (currentIndex + 1) % mShadows.length
            : (currentIndex - 1 + mShadows.length) % mShadows.length
        const { text, } = mShadows[currentIndex]
        shadowText.dataset.shadowId = mShadows[currentIndex].id
        shadowText.textContent = text
    }
    shadowPagers.appendChild(backPager)
    shadowPagers.appendChild(nextPager)
    shadowBox.appendChild(shadowPagers)
    /* loop */
    const seconds = 20 * 1000
    let intervalId
    startShadows()
    function startShadows(){
        stopShadows()
        intervalId = setInterval(_=>nextPager.click(), seconds)
    }
    function stopShadows(){
        clearInterval(intervalId)
    }
    return shadowBox
}
/**
 * Create a team member that has been selected from add-team-member icon.
 * @requires mActiveTeam
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mCreateTeamMember(event){
    event.stopPropagation()
    const { value: type, } = this
    if(!type)
        throw new Error(`no team member type selected`)
    // const { description, id, teams, } = await mCreateBot(type)
    const bot = await mCreateBot(type)
    if(!bot)
        throw new Error(`no bot created for team member`)
    const { description, id, teams, } = bot
    mBots.push(bot)
    setActiveBot(id)
    updatePageBots(mBots, true, true)
}
/**
 * Create a team new popup.
 * @requires mActiveTeam
 * @requires mTeamPopup
 * @requires mTeams
 * @param {string} type - The type of team to create.
 * @param {boolean} showPopup - Whether or not to show the popup.
 * @returns {void}
 */
function mCreateTeamPopup(type, clickX=0, clickY=0, showPopup=true){
    const { allowCustom, allowedTypes, } = mActiveTeam
    mTeamPopup.style.visibility = 'hidden'
    mTeamPopup.innerHTML = '' // clear existing
    const teamPopup = document.createElement('div')
    teamPopup.classList.add(`team-popup-${ type }`, 'team-popup-content')
    teamPopup.id = `team-popup-${ type }`
    teamPopup.name = `team-popup-${ type }`
    let popup
    let offsetX = 0
    let listener
    switch(type){
        case 'addTeamMember':
            const memberSelect = document.createElement('select')
            memberSelect.id = `team-member-select`
            memberSelect.name = `team-member-select`
            memberSelect.classList.add('team-member-select')
            const memberOption = document.createElement('option')
            memberOption.disabled = true
            memberOption.innerText = 'Select a team member to add...'
            memberOption.selected = true
            memberOption.value = ''
            memberSelect.appendChild(memberOption)
            allowedTypes.forEach(type=>{
                if(mBots.find(bot=>bot.type===type)) // no duplicates currently
                    return
                const memberOption = document.createElement('option')
                memberOption.innerText = type
                memberOption.value = type
                memberSelect.appendChild(memberOption)
            })
            if(allowCustom){
                const divider = document.createElement('optgroup')
                divider.label = "-----------------"
                memberSelect.appendChild(divider)
                const memberOptionCustom = document.createElement('option')
                memberOptionCustom.value = 'custom'
                memberOptionCustom.innerText = 'Create a custom team member...'
                memberSelect.appendChild(memberOptionCustom)
            }
            memberSelect.addEventListener('click', (e)=>e.stopPropagation()) // stops from closure onClick
            memberSelect.addEventListener('change', mCreateTeamMember, { once: true })
            listener = mTeamMemberSelect
            popup = memberSelect
            break
        case 'selectTeam':
            console.log('Create team select popup:', mTeams, mActiveTeam)
            const teamSelect = document.createElement('select')
            teamSelect.id = `team-select`
            teamSelect.name = `team-select`
            teamSelect.classList.add('team-select')
            const teamOption = document.createElement('option')
            teamOption.disabled = true
            teamOption.innerText = `MyLife's pre-defined agent teams...`
            teamOption.selected = true
            teamOption.value = ''
            teamSelect.appendChild(teamOption)
            mTeams.forEach(team=>{
                const { name, } = team
                const teamOption = document.createElement('option')
                teamOption.value = name
                teamOption.innerText = name
                teamSelect.appendChild(teamOption)
            })
            teamSelect.addEventListener('click', (e)=>e.stopPropagation()) // stops from closure onClick
            listener = mTeamSelect
            popup = teamSelect
            break
        default:
            break
    }
    mTeamPopup.appendChild(teamPopup)
    if(showPopup){
        show(mTeamPopup)
        document.addEventListener('click', mCloseTeamPopup, { once: true })
        document.addEventListener('keydown', mCloseTeamPopup)
    }
    if(popup){
        teamPopup.appendChild(popup)
        mTeamPopup.style.position = 'absolute'
        offsetX = teamPopup.offsetWidth
        let leftPosition = clickX - offsetX / 2
        const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
        if(leftPosition < 0)
            leftPosition = 0
        else if(leftPosition + offsetX > viewportWidth)
            leftPosition = viewportWidth - offsetX
        mTeamPopup.style.left = `${ leftPosition }px`
        mTeamPopup.style.top = `${clickY}px`
        popup.focus()
        if(listener)
            popup.addEventListener('change', listener, { once: true })
    }
    mTeamPopup.style.visibility = 'visible'
}
/**
 * Create add a team member popup.
 */
function mCreateTeamMemberSelect(event){
    event.stopPropagation()
    const { clientX, clientY, } = event
    mCreateTeamPopup('addTeamMember', clientX, clientY, true)
}
/**
 * Create a team select popup.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mCreateTeamSelect(event){
    event.stopPropagation()
    const { clientX, clientY, } = event
    mCreateTeamPopup('selectTeam', clientX, clientY, true)
}
/**
 * Delete collection item.
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mDeleteCollectionItem(event){
    event.stopPropagation()
    const id = event.target.id.split('_').pop()
    const item = document.getElementById(`collection-item_${ id }`)
    /* confirmation dialog */
    const userConfirmed = confirm("Are you sure you want to delete this item?")
    if(userConfirmed){
        /* talk to server */
        const url = window.location.origin + '/members/items/' + id
        const method = 'DELETE'
        let response = await fetch(url, { method: method })
        response = await response.json()
        if(response){
            expunge(item)
            if(getActiveItemId()===id)
                unsetActiveItem()
        }
    } else
        item.addEventListener('click', mDeleteCollectionItem, { once: true })
}
/**
 * Find checkbox associated with element, or errors.
 * @param {HTMLElement} element - The element to search for checkbox.
 * @param {boolean} searchParent - Whether or not to search parent element.
 * @returns {HTMLElement} - The input checkbox found in element.
 */
function mFindCheckbox(element, searchParent=true){
    const { children, parentElement, } = element
    if(mIsInputCheckbox(element))
        return element
    for(let child of children){
        const result = mFindCheckbox(child, false)
        if(result)
            return result
    }
    if(searchParent && parentElement){
        const { children: parentChildren, } = parentElement
        // do not run second time (obviously)
        for(let child of parentChildren){
            if(child===element)
                continue // skip redundant processing
            const result = mFindCheckbox(child, false)
            if(result)
                return result
        }
    }
}
/**
 * Paints bot-greeting to column
 * @private
 * @requires mActiveBot
 * @param {boolean} dynamic - Whether or not to add event listeners for dynamic greeting.
 * @returns {void}
 */
function mGreeting(dynamic=false){
    const greeting = Array.isArray(mActiveBot.greeting)
        ?   mActiveBot.greeting
        :   [
                mActiveBot?.greeting
            ?? mActiveBot?.description
            ?? mActiveBot?.purpose
            ]
    if(!greeting.length)
        throw new Error(`No bot-greeting provided.`)
    /* bot-greeting routine */
    setTimeout(() => { // Set a timeout for 1 second to wait for the first line to be fully painted
        // Set another timeout for 7.5 seconds to add the second message
        const timerId = setTimeout(addIntroductionMessage, 7500)
        /* add listeners */
        window.addEventListener('mousemove', addIntroductionMessage, { once: true })
        window.addEventListener('click', addIntroductionMessage, { once: true })
        window.addEventListener('focus', addIntroductionMessage, { once: true })
        window.addEventListener('scroll', addIntroductionMessage, { once: true })
        /* local timeout functions */
        function addIntroductionMessage() { // Clear the 7.5 seconds timeout if any event is triggered
            clearTimeout(timerId)
            greeting.forEach(_greeting =>{
                addMessage(_greeting)
            })
            cleanupListeners()
        }
        /* cleanup */
        function cleanupListeners() {
            window.removeEventListener('mousemove', addIntroductionMessage)
            window.removeEventListener('click', addIntroductionMessage)
            window.removeEventListener('focus', addIntroductionMessage)
            window.removeEventListener('scroll', addIntroductionMessage)
        }
    }, 1000)
}
/**
 * Toggle submit button for input passphrase.
 * @requires passphraseInput
 * @returns {void}
 */
function mInputPassphrase(){
    if(passphraseInput?.value?.length)
        show(passphraseSubmitButton)
    else
        hide(passphraseSubmitButton)
}
/**
 * Determines whether or not the element is an input checkbox.
 * @param {HTMLElement} element - The element to check.
 * @returns {boolean} - Whether or not the element is an input checkbox.
 */
function mIsInputCheckbox(element){
    const { tagName, type, } = element
    const outcome = tagName.toLowerCase()==='input' && type.toLowerCase()==='checkbox'
    return outcome
}
async function mObscureEntry(event){
    event.preventDefault()
    event.stopPropagation()
    /* set active item */
    const { id: itemId, } = this.dataset
    if(itemId)
        setActiveItem(itemId)
    toggleMemberInput(false, false)
    const popupClose = document.getElementById(`popup-close_${ itemId }`)
    if(popupClose)
        popupClose.click()
    const { responses, success, } = await obscure(itemId)
    if(responses?.length)
        addMessages(responses)
    toggleMemberInput(true)
}
/**
 * Open bot container for passed element, closes all the rest.
 * @param {HTMLDivElement} element - The bot container.
 * @returns {void}
 */
function mOpenStatusDropdown(element){
    document.querySelectorAll('.bot-container, .collections-container')
        .forEach(otherContainer=>{
            if(otherContainer!==element){
                const otherContent = otherContainer.querySelector('.bot-options')
                if(otherContent)
                    otherContent.classList.remove('open')
                var otherDropdown = otherContainer.querySelector('.bot-options-dropdown')
                if(otherDropdown)
                    otherDropdown.classList.remove('open')
            }
        })
        var content = element.querySelector('.bot-options') // even collections use bot-options
        if(content)
            content.classList.toggle('open')
        var dropdown = element.querySelector('.bot-options-dropdown')
        if(dropdown)
            dropdown.classList.toggle('open')
}
/**
 * Refresh designated collection from server.
 * @this - collection-refresh
 * @param {string} type - The collection type.
 * @param {HTMLDivElement} collectionList - The collection list, defaults to `collection-list-${ type }`.
 * @returns {void}
 */
async function mRefreshCollection(type, collectionList){
    if(!mAvailableCollections.includes(type))
        throw new Error(`Library collection not implemented.`)
    collectionList = collectionList
        ?? document.getElementById(`collection-list-${ type }`)
    if(!collectionList)
        throw new Error(`No collection list found for refresh request.`)
    const collection = await fetchCollections(type)
    mUpdateCollection(type, collectionList, collection)
}
async function mReliveMemory(event){
    event.preventDefault()
    event.stopPropagation()
    const { id, inputContent, } = this.dataset
    /* destroy previous instantiation, if any */
    const previousInput = document.getElementById(`relive-memory-input-container_${id}`)
    if(previousInput)
        expunge(previousInput)
    /* close popup */
    const popupClose = document.getElementById(`popup-close_${ id }`)
    if(popupClose)
        popupClose.click()
    toggleMemberInput(false, false, `Reliving memory with `)
    unsetActiveItem()
    const { command, parameters, messages, success, } = await mReliveMemoryRequest(id, inputContent)
    if(success){
        toggleMemberInput(false, true)
        addMessages(messages, { bubbleClass: 'relive-bubble' })
        const input = document.createElement('div')
        input.classList.add('memory-input-container')
        input.id = `relive-memory-input-container_${ id }`
        input.name = `input_${ id }`
        const inputClose = document.createElement('div')
        inputClose.classList.add('fas', 'fa-close', 'relive-memory-input-close')
        const inputContent = document.createElement('textarea')
        inputContent.classList.add('memory-input')
        inputContent.name = `memory-input_${ id }`
        const inputSubmit = document.createElement('button')
        inputSubmit.classList.add('memory-input-button')
        inputSubmit.dataset.id = id
        inputSubmit.textContent = mDefaultReliveMemoryButtonText
        input.appendChild(inputClose)
        input.appendChild(inputContent)
        input.appendChild(inputSubmit)
        inputClose.addEventListener('click', event=>{
            event.preventDefault()
            event.stopPropagation()
            mStopRelivingMemory(id)
        }, { once: true })
        inputContent.addEventListener('input', event=>{
            const { value, } = event.target
            inputSubmit.dataset.inputContent = value
            inputSubmit.textContent = value.length > 2
                ? 'update'
                : mDefaultReliveMemoryButtonText
        })
        inputSubmit.addEventListener('click', mReliveMemory, { once: true })
        addInput(input)
    } else {
        toggleMemberInput(true)
        throw new Error(`Failed to fetch memory for relive request.`)
    }
}
/**
 * 
 * @param {Guid} id - The memory collection item id.
 * @param {string} memberInput - The member's updates to the memory.
 * @returns 
 */
async function mReliveMemoryRequest(id, memberInput){
    console.log('Relive memory:', id, memberInput)
    try {
        const url = window.location.origin + '/members/memory/relive/' + id
        let response = await fetch(url, {
            body: memberInput?.length ? JSON.stringify({ memberInput, }) : null,
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        if(!response.ok)
            throw new Error(`HTTP error! Status: ${response.status}`)
        response = await response.json()
        return response
    } catch (error) {
        console.log('Error fetching memory for relive:', error)
    }
}
async function mReliveMemoryRequestStop(id){
    console.log('Stop reliving memory:', id)
    try {
        const url = window.location.origin + '/members/memory/end/' + id
        let response = await fetch(url, {
            method: 'PATCH',
        })
        if(!response.ok)
            throw new Error(`HTTP error! Status: ${response.status}`)
        response = await response.json()
        return response
    } catch (error) {
        console.log('Error stopping relive memory:', error)
    }
}
/**
 * Request to retire an identified bot.
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mRetireBot(event){
    event.preventDefault()
    event.stopPropagation()
    try {
        const { dataset, id, } = event.target
        const { botId, type, } = dataset
        /* reset active bot */
        if(mActiveBot.id===botId)
            setActiveBot()
        /* retire bot */
        const url = window.location.origin + '/members/bots/' + botId
        let response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'DELETE',
        })
        if(!response.ok)
            throw new Error(`HTTP error! Status: ${response.status}`)
        response = await response.json()
        addMessages(response.responses)
    } catch(err) {
        console.log('Error posting bot data:', err)
        addMessage(`Error posting bot data: ${err.message}`)
    }
}
/**
 * Retires chat thread on server and readies for a clean one.
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mRetireChat(event){
    event.preventDefault()
    event.stopPropagation()
    try {
        const { dataset, id, } = event.target
        const { botId, type, } = dataset
        const url = window.location.origin + '/members/retire/chat/' + botId
        let response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST',
        })
        if(!response.ok)
            throw new Error(`HTTP error! Status: ${response.status}`)
        response = await response.json()
        addMessages(response.responses)
    } catch(err) {
        console.log('Error posting bot data:', err)
        addMessage(`Error posting bot data: ${err.message}`)
    }
}
/**
 * Set Bot data on server.
 * @param {Object} bot - bot object
 * @returns {object} - response from server
 */
async function mSetBot(bot){
    try {
        const { id, } = bot
        const url = window.location.origin + '/members/bots/' + id
        const method = id?.length
            ? 'PUT' // update
            : 'POST' // create
        let response = await fetch(url, {
            body: JSON.stringify(bot),
            headers: {
                'Content-Type': 'application/json'
            },
            method: method,
        })
        if(!response.ok)
            throw new Error(`HTTP error! Status: ${response.status}`)
        return true
    } catch (error) {
        console.log('Error posting bot data:', error)
        alert('Error posting bot data:', error.message)
        return false
    }
}
/**
 * Sets bot attributes on bot container.
 * @private
 * @requires mActiveBot
 * @requires mGlobals
 * @param {object} bot - The bot object.
 * @param {HTMLDivElement} botContainer - The bot container.
 * @returns {void}
 */
function mSetAttributes(bot=mActiveBot, botContainer){
    const {
        activated=[],
        activeFirst,
        bot_name='Anonymous',
        dob,
        flags,
        id: bot_id,
        interests,
        name,
        narrative,
        privacy,
        type,
        updates,
        version
    } = bot
    /* attributes */
    const botName = name
        ?? bot_name
    const attributes = [
        { name: 'activated', value: activated },
        { name: 'active', value: mBotActive(bot_id) },
        { name: 'activeFirst', value: activeFirst },
        { name: 'bot_id', value: bot_id },
        { name: 'bot_name', value: botName },
        { name: 'id', value: bot_id },
        { name: 'initialized', value: Date.now() },
        { name: 'type', value: type },
        { name: 'version', value: version },
    ]
    if(dob)
        attributes.push({ name: 'dob', value: dob })
    if(flags)
        attributes.push({ name: 'flags', value: flags })
    if(interests)
        attributes.push({ name: 'interests', value: interests })
    if(narrative)
        attributes.push({ name: 'narrative', value: narrative })
    if(privacy)
        attributes.push({ name: 'privacy', value: privacy })
    if(updates)
        attributes.push({ name: 'updates', value: updates })
    attributes.forEach(attribute=>{
        const { name, value, } = attribute
        botContainer.dataset[name] = value
        const element = document.getElementById(`${ type }-${ name }`)
        if(element){
            const botInput = element.querySelector('input')
            if(botInput)
                botInput.value = botContainer.getAttribute(`data-${ name }`)
        }
    })
}
/**
 * Sets bot container status bar based on bot, thread, and assistant population.
 * @private
 * @requires mActiveBot - active bot object, but can be undefined without error.
 * @param {object} bot - The bot object.
 * @returns {void}
 */
function mSetStatusBar(bot, botContainer){
    const { dataset, } = botContainer
    const { id, type, version, } = dataset
    const { id: botId, name, type: botType, version: botVersion, } = bot
    const botStatusBar = document.getElementById(`${ type }-status`)
    if(!type || !botType==type || !botStatusBar)
        return
    const response = {
        name,
        status: 'unknown',
        type: type.split('-').pop(),
    }
    /* status icon */
    const botIcon = document.getElementById(`${ type }-icon`)
    switch(true){
        case ( mActiveBot?.id==id ): // activated
            botIcon.classList.remove('online', 'offline', 'error')
            botIcon.classList.add('active')
            response.status = 'active'
            break
        case ( name?.length>0 ): // online
            botIcon.classList.remove('active', 'offline', 'error')
            botIcon.classList.add('online')
            response.status = 'online'
            break
        default: // error
            botIcon.classList.remove('active', 'online', 'offline')
            botIcon.classList.add('error')
            response.status = 'error'
            break
    }
    botContainer.dataset.status = response.status
    /* title-type */
    const botTitleType = document.getElementById(`${ type }-title-type`)
    if(botTitleType){
        response.type = response.type.charAt(0).toUpperCase()
            + response.type.slice(1)
        botTitleType.textContent = response.type
    }
    /* title-name */
    const botTitleName = document.getElementById(`${ type }-title-name`)
    if(botTitleName)
        botTitleName.textContent = response.name
    /* version */
    const botVersionElement = document.getElementById(`${ type }-title-version`)
    if(botVersionElement)
        botVersionElement.textContent = mVersion(version)
}
/**
 * Sets collection item content on server.
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSetCollectionItem(id, content, emoticons){
    const summary = content
    const url = window.location.origin + '/members/item/' + id
    const method = 'PUT'
    let response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emoticons, summary, })
    })
    if(!response.ok)
        return false
    response = await response.json()
    return response?.success
        ?? false
}
/**
 * Sets collection item title on server.
 * @param {Guid} id - The collection item id.
 * @param {string} title - The title to set.
 * @returns {boolean} - Whether or not the title was set.
 */
async function mSetCollectionItemTitle(id, title){
    if(!title?.length)
        throw new Error(`No title provided for title update`)
    const url = window.location.origin + '/members/item/' + id
    const method = 'PUT'
    let response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, title, })
    })
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    response = await response.json()
    if(!response.success || response.item?.title!==title)
        throw new Error(`Title "${ title }" not accepted.`)
    console.log('Set collection item title response:', title, response.item)
    return true
}
/**
 * Highlights bot bar icon of active bot.
 * @public
 * @requires mActiveBot
 * @returns {void}
 */
function mSpotlightBotBar(){
    document.querySelectorAll('.bot-thumb')
        .forEach(icon=>{
            if(icon.alt===mActiveBot?.type)
                icon.classList.add('bot-thumb-active')
            else
                icon.classList.remove('bot-thumb-active')
        })
}
/**
 * Highlights bot container of active bot.
 * @public
 * @requires mActiveBot
 * @returns {void}
 */
function mSpotlightBotStatus(){
    mBots
        .forEach(bot=>{
            const { id, type, } = bot
            const botContainer = document.getElementById(type)
            if(botContainer){ // exists on-page
                // set data attribute for active bot
                const { dataset, } = botContainer
                if(dataset && id)
                    botContainer.dataset.active = id===mActiveBot?.id
                mSetStatusBar(bot, botContainer)
            }
        })
}
/**
 * Click event to trigger server explanation of how to begin a diary.
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mStartDiary(event){
    event.preventDefault()
    event.stopPropagation()
    const submitButton = event.target
    const diaryBot = getBot('diary')
    if(!diaryBot)
        return
    hide(submitButton)
    unsetActiveItem()
    await setActiveBot(diaryBot.id)
    const response = await submit(`How do I get started?`, true)
    addMessages(response.responses)
}
async function mStopRelivingMemory(id){
    const input = document.getElementById(`relive-memory-input-container_${ id }`)
    if(input)
        expunge(input)
    await mReliveMemoryRequestStop(id)
    unsetActiveItem()
    toggleMemberInput(true)
}
/**
 * Submit updated `story` data. No need to return unless an error, which is currently thrown.
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mStory(event){
    event.stopPropagation()
    const { dataset, value, } = this
    const { id, type: field, } = dataset
    if(!value?.length)
        throw new Error(`No value provided for story update.`)
    const url = window.location.origin + '/members/item/' + id
    const method = 'PUT'
    let response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [`${ field }`]: value })
    })
    if(!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
    response = await response.json()
    if(!response.success)
        throw new Error(`Narrative "${ value }" not accepted.`)
}
async function mStoryContext(event){
    const { dataset, value, } = this
    const { previousValue, } = dataset
    if(previousValue==value)
        return
    mStory.bind(this)(event) // no need await
}
/**
 * Submit updated passphrase for MyLife via avatar.
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mSubmitPassphrase(event){
    const { value, } = passphraseInput
    if(!value?.length)
        return
    try{
        /* submit to server */
        const url = window.location.origin + '/members/passphrase'
        const method = 'POST'
        let response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ passphrase: value })
        })
        if(!response.ok)
            throw new Error(`HTTP error! Status: ${response.status}`)
        response = await response.json()
        if(!response.success)
            throw new Error(`Passphrase "${ value }" not accepted.`)
        mTogglePassphrase(false)
    } catch(err){
        console.log('Error submitting passphrase:', err)
        mTogglePassphrase(true)
    }
}
/**
 * Manages `change` event selection of team member from `team-select` dropdown.
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mTeamMemberSelect(event){
    const { value, } = this
    if(value?.length){ // request to server
        /* validate */
        const bot = mBot(value)
        if(bot)
            mUpdateBotContainers()
    }
    mCloseTeamPopup(event)
}
/**
 * Manages `change` event selection of team from `team-select` dropdown.
 * @requires mActiveTeam
 * @param {Event} event - The event object. 
 * @returns {void}
 */
function mTeamSelect(event){
    const { value, } = this
    mUpdateTeams(value) // `change` requires that value not be the same
    mCloseTeamPopup(event)
}
/**
 * Toggles bot containers and checks for various actions on master click of `this` bot-container. Sub-elements appear as targets and are rendered appropriately.
 * @private
 * @async
 * @param {Event} event - The event object, represents entire bot box as `this`.
 * @returns {void}
 */
async function mToggleBotContainers(event){
    event.stopPropagation()
    const botContainer = this
    const element = event.target
    const { dataset, id, } = botContainer
    const itemIdSnippet = element.id.split('-').pop()
    switch(itemIdSnippet){
        case 'name':
        case 'title':
        case 'titlebar':
            mOpenStatusDropdown(this)
            break
        case 'icon':
        case 'type':
            if(dataset?.status && !(['error', 'offline', 'unknown'].includes(dataset.status)))
                await setActiveBot(dataset?.id ?? id, true)
            break
        case 'status':
        case 'type':
        case 'dropdown':
            mOpenStatusDropdown(this)
            break
        case 'update':
        case 'upload':
            break
        case 'version':
            console.log('Version:', dataset.version, 'check version against server', mTeams)
            break
        default:
            break
    }
}
/**
 * Toggles collection item visibility.
 * @this - collection-bar
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mToggleCollectionItems(event){
    event.stopPropagation()
    /* constants */
    const { target, } = event /* currentTarget=collection-bar, target=interior divs */
    const { dataset, id, } = this
    const type = id.split('-').pop()
    const refreshTrigger = document.getElementById(`collection-refresh-${ type }`)
    const isRefresh = target.id===refreshTrigger.id
    const itemList = document.getElementById(`collection-list-${ type }`)
    /* validation */
    if(!itemList)
        throw new Error(`Collection list not found for toggle.`)
    /* functionality */
    if(dataset.init!=='true' || isRefresh){ // first click or refresh
        show(refreshTrigger)
        refreshTrigger.classList.add('spin')
        await mRefreshCollection(type)
        dataset.init = 'true'
        refreshTrigger.classList.remove('spin')
        show(target)
        show(itemList) // even if `none`
    } else
        toggleVisibility(itemList)
}
/**
 * Toggles passphrase input visibility.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mTogglePassphrase(event){
    /* set properties */
    passphraseInput.value = ''
    passphraseInput.placeholder = 'Enter new passphrase...'
    hide(passphraseSubmitButton)
    if(event.target===passphraseResetButton){
        passphraseInput.focus()
        passphraseInput.addEventListener('input', mInputPassphrase)
        passphraseCancelButton.addEventListener('click', mTogglePassphrase, { once: true })
        passphraseSubmitButton.addEventListener('click', mSubmitPassphrase)
        hide(passphraseResetButton)
        show(passphraseInputContainer)
    } else {
        passphraseInput.blur()
        passphraseInput.removeEventListener('input', mInputPassphrase)
        passphraseSubmitButton.removeEventListener('click', mSubmitPassphrase)
        passphraseResetButton.addEventListener('click', mTogglePassphrase, { once: true })
        hide(passphraseInputContainer)
        show(passphraseResetButton)
    }
}
/**
 * Toggles popup visibility.
 * @this - collection-item
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mTogglePopup(event){
    event.stopPropagation()
    const { id, } = this
    const popupId = id.split('_').pop()
    const popup = document.getElementById(`popup-container_${ popupId }`)
    if(!popup)
        throw new Error(`Popup not found: ${ popupId }`)
    const { active, } = popup.dataset
    const isClose = event.target?.dataset?.isClose
    if(active=='true' || isClose){ /* close */
        popup.dataset.active = 'false'
        popup.style.opacity = 0
        hide(popup)
    } else { /* open */
        let { offsetX, offsetY, } = popup.dataset
        if(!offsetX || !offsetY){ // initial placement onscreen
            const item = popup.parentElement // collection-item
            /* calculate desired position */
            const popupHalfHeight = popup.offsetHeight / 2
            const itemHalfHeight = item.offsetHeight / 2
            const desiredMiddlePosition = item.offsetTop + itemHalfHeight
            let topPosition = desiredMiddlePosition - popupHalfHeight
            /* screen failsafes */
            if(topPosition < 0){
                topPosition = 0
            } else if (topPosition + popup.offsetHeight > window.innerHeight){
                topPosition = window.innerHeight - popup.offsetHeight
            }
            const leftPosition = item.offsetLeft - popup.offsetWidth - 10 // hard-coded 10px to the left
            /* set dataset */
            offsetX = `${ leftPosition }px`
            offsetY = `${ topPosition }px`
            popup.dataset.offsetY = offsetY
            popup.dataset.offsetX = offsetX
        }
        /* position */
        popup.style.left = offsetX
        popup.style.right = 'auto'
        popup.style.top = offsetY
        show(popup)
        if(setActiveItem(popupId)){
            // @todo - deactivate any other popups
            popup.dataset.active = 'true'
        }
    }
}
/**
 * 
 * @param {HTMLElement} element - The element to toggle classes on.
 * @param {array} add - The classes to add.
 * @param {array} remove - The classes to remove.
 * @returns {void}
 */
function mToggleClass(element, add=[], remove=[]){
    remove.forEach(className=>element.classList.remove(className))
    add.forEach(className=>element.classList.add(className))
}
/**
 * Toggles switch for element.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mToggleSwitch(event){
    let target = this
    if(event){
        event.preventDefault()
        event.stopPropagation()
        target = event.target
    }
    const { children, } = this
    let { id, } = this /* parent toggle id */
    id = mGlobals.HTMLIdToType(id)
    const associatedSwitch = mFindCheckbox(target) /* throws on missing */
    const { checked, } = associatedSwitch
    const { checkedValue=`${ event ? !checked : checked}`, } = target.dataset
    associatedSwitch.checked = checkedValue==='true'
    let labelId
    /* send array children of this */
    const labels = Array.from(children)
        .filter(child=>{
            const { tagName, } = child
            return tagName.toLowerCase()==='label'
        })
    labels.forEach(label=>{
        const { dataset, id: childLabelId, } = label
        const { checked, } = associatedSwitch
        const { checkedValue=`${ checked }`, } = dataset
        if(checkedValue?.toLowerCase()===`${ checked }`)
            labelId = childLabelId
    })
    if(labelId && labels.length)
        mUpdateLabels(labelId, labels)
}
/**
 * Toggles the privacy switch for the bot.
 * @param {Event} event - The event object.
 * @returns {void}
 */
function mToggleSwitchPrivacy(event){
    let { id, } = this
    id = id.replace('-toggle', '') // remove toggle
    const type = mGlobals.HTMLIdToType(id)
    console.log('mToggleSwitchPrivacy', type)
    const publicityCheckbox = document.getElementById(`${ type }-publicity-input`)
    const viewIcon = document.getElementById(`${ type }-publicity-toggle-view-icon`)
    const { checked=false, } = publicityCheckbox
    mToggleSwitch.bind(this)(event)
    mToggleClass(viewIcon, !checked ? ['fa-eye'] : ['fa-eye-slash'], checked ? ['fa-eye'] : ['fa-eye-slash'])
    this.addEventListener('click', mToggleSwitchPrivacy, { once: true })
}
/**
 * Activates bot bar icon and container. Creates div and icon in bot bar.
 * @todo - limit to bots that actually show on sidebar?
 * @requires mActiveBot
 * @requires mBots
 * @returns {void}
 */
function mUpdateBotBar(){
    const botBarBots = []
    botBar.innerHTML = ''
    if(!mBots?.length)
        throw new Error(`No bots found for bot bar.`)
    const avatarThumb = mCreateBotThumb(getBot())
    botBar.appendChild(avatarThumb) // avatar
    botBar.appendChild(_thumbDivider())
    botBarBots.push(getBot().id) // active bot
    mActiveTeam?.bots // active team bots
        .forEach(bot=>{
            botBar.appendChild(mCreateBotThumb(bot))
            botBarBots.push(bot.id)
        })
    botBar.appendChild(_thumbDivider())
    // create remaining bots
    mBots
        .filter(bot=>!botBarBots.includes(bot.id))
        .forEach(bot=>{
            botBar.appendChild(mCreateBotThumb(bot))
            botBarBots.push(bot.id)
        })
    function _thumbDivider(){
        const divider = document.createElement('div')
        divider.classList.add('bot-bar-divider')
        return divider
    }
}
/**
 * Updates bot-widget containers for whom there is data. If no bot data exists, ignores container.
 * @todo - creation mechanism for new bots or to `reinitialize` or `reset` current bots, like avatar.
 * @todo - architect  better mechanic for populating and managing bot-specific options
 * @async
 * @requires mBots
 * @param {boolean} includePersonalAvatar - Include personal avatar, use false when switching teams.
 * @returns {void}
 */
async function mUpdateBotContainers(includePersonalAvatar=true){
    if(!mBots?.length)
        throw new Error(`mBots not populated.`)
    const botContainers = Array.from(document.querySelectorAll('.bot-container'))
    if(!botContainers.length)
        throw new Error(`No bot containers found on page`)
    botContainers
        .forEach(async botContainer=>mUpdateBotContainer(botContainer, includePersonalAvatar))
    /* library container */
    if(!mCollections || !mCollections.children.length)
        return
    for(let collection of mCollections.children){
        let { id, } = collection
        id = id.split('-').pop()
        if(!mAvailableCollections.includes(id)){
            console.log('Library collection not found.', id)
            continue
        }
        const collectionBar = document.getElementById(`collection-bar-${ id }`)
        if(collectionBar){
            const { dataset, } = collectionBar
            const itemList = document.getElementById(`collection-list-${ id }`)
            dataset.init = itemList.querySelectorAll(`.${ id }-collection-item`).length > 0
                    ? 'true' // externally refreshed
                    : dataset.init // tested empty
                        ?? 'false'
            /* update collection list */
            const refresh = document.getElementById(`collection-refresh-${ id }`)
            if(dataset.init!=='true' && refresh) // first click
                hide(refresh)
            collectionBar.addEventListener('click', mToggleCollectionItems)
        }
    }
    mCollectionsContainer.addEventListener('click', mToggleBotContainers)
    if(mCollectionsUpload)
        mCollectionsUpload.addEventListener('click', mUploadFiles)

}
/**
 * Updates the bot container with specifics.
 * @todo - will need to refactor to allow for on-demand containers; could still come from HTML fragments, but cannot be "hard-coded" by type as they are, given that different teams will have different bots of the _same_ `type`.
 * @param {HTMLDivElement} botContainer - The bot container.
 * @param {boolean} includePersonalAvatar - Include personal avatar.
 * @returns {void}
 */
function mUpdateBotContainer(botContainer, includePersonalAvatar=true) {
    const { id: type } = botContainer
    if(type==='personal-avatar' && !includePersonalAvatar)
        return /* skip personal avatar when requested */
    const bot = mBot(type) // @stub - careful of multiples once allowed!
    if(!bot){
        hide(botContainer)
        return /* no problem if not found, likely available different team */
    }
    /* container listeners */
    botContainer.addEventListener('click', mToggleBotContainers)
    /* universal logic */
    mSetAttributes(bot, botContainer) // first, assigns data attributes
    mSetStatusBar(bot, botContainer)
    mUpdateInterests(botContainer)
    /* type-specific logic */
    mUpdateBotContainerAddenda(botContainer, bot)
    show(botContainer)
}
/**
 * Updates the bot container with specifics based on `type`.
 * @param {HTMLDivElement} botContainer - The bot container.
 * @returns {void}
 */
function mUpdateBotContainerAddenda(botContainer){
        if(!botContainer)
            return
        /* type-specific logic */
        const { dataset, id: type } = botContainer
        const { id, } = dataset
        const localVars = {}
        if(dataset) // assign dataset to localVars for state manipulation and rollback
            Object.keys(dataset).forEach(key=>localVars[key] = dataset[key])
        const botNameInput = document.getElementById(`${ type }-input-bot_name`)
        /* attach bot name listener */
        if(botNameInput){
            botNameInput.addEventListener('change', async event=>{
                dataset.bot_name = botNameInput.value
                const { bot_name, } = dataset
                const updatedBot = {
                    bot_name,
                    id,
                    type,
                }
                if(await mSetBot(updatedBot)){
                    const botTitleName = document.getElementById(`${ type }-title-name`)
                    if(botTitleName)
                        botTitleName.textContent = bot_name
                    localVars.bot_name = bot_name
                    /* update mBot */
                    const bot = mBot(id)
                    bot.bot_name = bot_name
                    bot.name = bot_name
                } else {
                    dataset.bot_name = localVars.bot_name
                }
            })
        }
        /* publicity */
        const publicityToggle = document.getElementById(`${ type }-publicity-toggle`)
        if(publicityToggle){
            publicityToggle.addEventListener('click', mToggleSwitchPrivacy)
            const publicityToggleView = document.getElementById(`${ type }-publicity-toggle-view-icon`)
            if(publicityToggleView){
                const { checked=false, } = document.getElementById(`${ type }-publicity-input`) ?? {}
                mToggleClass(publicityToggleView, !checked ? ['fa-eye-slash'] : ['fa-eye'], checked ? ['fa-eye'] : ['fa-eye-slash'])
                publicityToggleView.addEventListener('click', event=>{
                    // @note - shouldn't be required, but container masters the switch
                    event.stopImmediatePropagation()
                    event.stopPropagation()
                })
            }
        }
        /* retirements */
        const retireChatButton = document.getElementById(`${ type }-retire-chat`)
        if(retireChatButton){
            retireChatButton.dataset.botId = id
            retireChatButton.dataset.type = type
            retireChatButton.addEventListener('click', mRetireChat)
        }
        const retireBotButton = document.getElementById(`${ type }-retire-bot`)
        if(retireBotButton){
            retireBotButton.dataset.botId = id
            retireBotButton.dataset.type = type
            retireBotButton.addEventListener('click', mRetireBot)
        }
        switch(type){
            case 'avatar':
            case 'personal-avatar':
                /* attach avatar listeners */
                /* set additional data attributes */
                mTogglePassphrase(false) /* passphrase */
                const tutorialButton = document.getElementById('personal-avatar-tutorial')
                if(tutorialButton){
                    if(experiences().length){
                        show(tutorialButton)
                        tutorialButton.addEventListener('click', async event=>{
                            hide(tutorialButton)
                            const tutorialId = 'aae28fe4-30f9-4c29-9174-a0616569e762'
                            startExperience(tutorialId) // no await
                        }, { once: true })
                    } else
                        hide(tutorialButton)
                }
                break
            case 'biographer':
            case 'journaler':
            case 'personal-biographer':
                break
            case 'diary':
                // add listener on `diary-start` button
                const diaryStart = document.getElementById('diary-start')
                if(diaryStart)
                    diaryStart.addEventListener('click', mStartDiary)
                break
            default:
                break
        }
}
/**
 * Updates bot version on server.
 * @param {Event} event - The event object
 * @returns {void}
 */
async function mUpdateBotVersion(event){
    event.stopPropagation()
    const { classList, dataset,} = event.target
    const { botId, currentVersion, updateVersion, } = dataset
    if(currentVersion==updateVersion)
        return
    const updatedVersion = await mBotVersionUpdate(botId)
    if(updatedVersion?.success){
        const { version, } = updatedVersion.bot
        dataset.currentVersion = version
        event.target.textContent = mVersion(version)
        classList.remove('update-available')
    }
}
/**
 * Update the identified collection with provided specifics.
 * @param {string} type - The collection type.
 * @param {HTMLDivElement} collectionList - The collection container.
 * @param {Array} collection - The collection items.
 * @returns {void}
 */
function mUpdateCollection(type, collectionList, collection){
    collectionList.innerHTML = ''
    collection
        .map(item=>({
            ...item,
            name: item.name
                ?? item.filename
                ?? type,
            type: item.type
                ?? item.being
                ?? type,
        }))
        .filter(item=>item.type===type)
        .sort((a, b)=>a.name.localeCompare(b.name))
        .forEach(item=>{
            collectionList.appendChild(mCreateCollectionItem(item))
        })
}

/**
 * Sets collection item content.
 * @private
 * @async
 * @param {Event} event - The event object.
 * @returns {void}
 */
async function mUpdateCollectionItem(event){
    event.stopPropagation()
    const { contentId, id, } = this.dataset
    const contentElement = document.getElementById(contentId)
    if(!contentElement)
        throw new Error(`No content found for collection item update.`)
    const { dataset, } = contentElement
    const { emoticons=[], lastUpdatedContent, } = dataset
    const { value: content, } = contentElement
    if(content!=lastUpdatedContent && await mSetCollectionItem(id, content, emoticons))
        contentElement.dataset.lastUpdatedContent = content
    else
        contentElement.value = lastUpdatedContent
}
function mUpdateCollectionItemTitle(event){
    event.stopPropagation()
    const span = event.target
    const { id, } = span
    const itemId = id.split('_').pop()
    /* make title editable */
    // @stub - check for other active inputs and trigger them closed without save
    /* create input */
    const input = document.createElement('input')
    input.id = `collection-item-title-input_${ itemId }`
    input.name = 'collection-item-title-input'
    input.type = 'text'
    input.value = span.textContent
    input.className = span.className
    /* replace span with input */
    span.replaceWith(input)
    /* add listeners */
    input.addEventListener('keydown', (event)=>{
        if(event.key==='Enter')
            input.blur()
        else if(event.key==='Escape'){
            input.value = span.textContent
            input.blur()
        }
    })
    input.addEventListener('blur', async event=>{
        if(input.value.length && input.value!==span.textContent){
            /* update server */
            console.log('Update title:', itemId, input.value)
            if(await mSetCollectionItemTitle(itemId, input.value)){
                const title = input.value
                // if successful update title in all sub-locations (including activeItem in members)
                span.textContent = title
                setActiveItemTitle(title, itemId)
                const popupHeader = document.getElementById(`popup-header_${ itemId }`)
                if(popupHeader)
                    popupHeader.textContent = title
            }
        }
        input.replaceWith(span)
        input.remove()
        span.addEventListener('dblclick', mUpdateCollectionItemTitle, { once: true })
    }, { once: true })
    input.focus()
}
/**
 * Update the bot interests checkbox structure with specifics.
 * @param {string} interests - The member's interests.
 * @param {HTMLElement} botContainer - The bot container.
 * @returns {void}
 */
function mUpdateInterests(botContainer){
    const { dataset, } = botContainer
    const { id, interests, type, } = dataset
    const interestsList = document.getElementById(`${ type }-interests`)
    if(!interestsList)
        return
    const checkboxes = interestsList.querySelectorAll('input[type="checkbox"]')
    if(interests?.length){
        dataset.interests = interests
        const interestsArray = interests.split('; ')
        checkboxes.forEach(checkbox=>{
            if(interestsArray.includes(checkbox.value)){
                checkbox.checked = true
            }
        })
    }
    /* add listeners to checkboxes */
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const { dataset, } = botContainer
            /* concatenate checked values */
            const checkedValues = Array.from(checkboxes)
                .filter(cb => cb.checked) // Filter only checked checkboxes
                .map(cb => cb.value) // Map to their values
                .join('; ')
            dataset.interests = checkedValues
            const { id, interests, type, } = dataset
            mSetBot({
                id,
                interests,
                type,
            })
        })
    })
}
/**
 * Update the bot labels with specifics.
 * @param {string} activeLabel - The active label.
 * @param {Array} labels - The array of possible labels.
 * @returns {void}
 */
function mUpdateLabels(activeLabelId, labels){
    labels.forEach(label=>{
        const { id, name, value, } = label
        if(id===activeLabelId){
            label.classList.remove('label-inactive')
            label.classList.add('label-active')
        } else {
            label.classList.remove('label-active')
            label.classList.add('label-inactive')
        }
    })
}
/**
 * Updates the active team to specific or default.
 * @requires mActiveTeam
 * @requires mAvailableTeams
 * @requires mDefaultTeam
 * @requires mTeams
 * @param {string} identifier - The name or id of active team.
 * @returns {void}
 */
async function mUpdateTeams(identifier=mDefaultTeam){
    if(!mTeams?.length)
        mTeams.push(...await fetchTeams())
    const team = mTeams
        .find(team=>team.name===identifier || team.id===identifier)
    if(!team)
        throw new Error(`Team "${ identifier }" not available at this time.`)
    if(mActiveTeam!==team){
        const { id: teamId, } = team
        const activeTeam = await fetchTeam(teamId) // set team on server and receive bot ids in `bots`
        if(activeTeam)
            mActiveTeam = activeTeam
    }
    const { allowedTypes, description, id, name, title, } = team
    mTeamName.dataset.id = id
    mTeamName.dataset.description = description
    mTeamName.innerText = `${ title ?? name } Team`
    mTeamName.title = description
    // @stub mTeamName.addEventListener('click', mCreateTeamSelect)
    mTeamAddMemberIcon.addEventListener('click', mCreateTeamMemberSelect)
    hide(mTeamPopup)
    show(mTeamHeader)
}
/**
 * Upload Files to server from any .
 * @async
 * @requires mAvailableMimeTypes
 * @requires mAvailableUploaderTypes
 * @requires mGlobals
 * @requires mCollectionsUpload
 * @param {Event} event - The event object.
 */
async function mUploadFiles(event){
    const { id, parentNode: uploadParent, } = this
    const type = mGlobals.HTMLIdToType(id)
    if(!mAvailableUploaderTypes.includes(type))
        throw new Error(`Uploader "${ type }" not found, upload function unavailable for this bot.`)
    let fileInput
    try{
        console.log('mUploadFiles()::uploader', document.activeElement)
        mCollectionsUpload.disabled = true
        fileInput = document.createElement('input')
        fileInput.id = `file-input-${ type }`
        fileInput.multiple = true
        fileInput.name = fileInput.id
        fileInput.type = 'file'
        uploadParent.appendChild(fileInput)
        hide(fileInput)
        fileInput.click()
        window.addEventListener('focus', async event=>{
            await mUploadFilesInput(fileInput, uploadParent, mCollectionsUpload)
        }, { once: true })
    } catch(error) {
        mUploadFilesInputRemove(fileInput, uploadParent, mCollectionsUpload)
        console.log('mUploadFiles()::ERROR uploading files:', error)
    }
}
async function mUploadFilesInput(fileInput, uploadParent, uploadButton){
    fileInput.addEventListener('change', async event=>{
        const { files: uploads, } = fileInput
        if(uploads?.length){
            /* send to server */
            const formData = new FormData()
            for(let file of uploads){
                formData.append('files[]', file)
            }
            formData.append('type', mGlobals.HTMLIdToType(uploadParent.id))
            const response = await fetch('/members/upload', {
                method: 'POST',
                body: formData
            })
            const { files, message, success, } = await response.json()
            const type = 'file'
            const itemList = document.getElementById(`collection-list-${ type }`)
            mUpdateCollection(type, itemList, files)
            console.log('mUploadFilesInput()::files', files, uploads, type)
        }
    }, { once: true })
    mUploadFilesInputRemove(fileInput, uploadParent, uploadButton)
}
function mUploadFilesInputRemove(fileInput, uploadParent, uploadButton){
    if(fileInput && uploadParent.contains(fileInput))
        uploadParent.removeChild(fileInput)
    uploadButton.disabled = false
}
/**
 * Versions per frontend.
 * @param {string} version - The version to format
 * @returns {string} - The formatted version
 */
function mVersion(version){
    version = version.toString()
    version = `v.${ version?.includes('.') ? version : `${ version }.0` ?? '1.0' }`
    return version
}
/* exports */
// @todo - export combine of fetchBots and updatePageBots
export {
    activeBot,
    fetchBots,
    fetchCollections,
    fetchTeam,
    fetchTeams,
    getBot,
    getItem,
    refreshCollection,
    setActiveBot,
    togglePopup,
    updateItem,
    updatePageBots,
}