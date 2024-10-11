/* imports */
import oAIAssetAssistant from './agents/system/asset-assistant.mjs'
import {
	upload as apiUpload,
} from './api-functions.mjs'
/* module export functions */
async function about(ctx){
	ctx.state.title = `About MyLife`
	await ctx.render('about')
}
/**
 * Activate a bot for the member
 * @module
 * @public
 * @api no associated view
 * @param {object} ctx Koa Context object
 * @returns {object} Koa Context object
 */
function activateBot(ctx){
	const { avatar, } = ctx.state
	avatar.activeBotId = ctx.params.bid
	const { activeBotId, activeBotVersion, activeBotNewestVersion, } = avatar
	ctx.body = {
		activeBotId,
		activeBotVersion,
		version: activeBotNewestVersion,
	}
}
async function alerts(ctx){
	// @todo: put into ctx the _type_ of alert to return, system use dataservices, member use personal
	const { MemberSession, } = ctx.state
	if(ctx.params?.aid){ // specific system alert
		ctx.body = await ctx.state.MemberSession.alert(ctx.params.aid)
	} else { // all system alerts
		ctx.body = await ctx.state.MemberSession.alerts(ctx.request.body)
	}
}
async function bots(ctx){
	const { bid, } = ctx.params // botId sent in url path
	const { avatar } = ctx.state
	const bot = ctx.request.body ?? {}
	const { id, } = bot
	switch(ctx.method){
		case 'POST': // create new bot
			ctx.body = await avatar.createBot(bot)
			break
		case 'PUT': // update bot
			ctx.body = await avatar.updateBot(bot)
			break
		case 'GET':
		default:
			if(bid?.length){ // specific bot
				ctx.body = await avatar.bot(ctx.params.bid)
			} else {
				const {
					activeBotId,
					bots: awaitBots,  // **note**: bots needs await
					mbr_id,
				} = avatar
				const bots = await awaitBots
				ctx.body = { // wrap bots
					activeBotId,
					bots,
					mbr_id,
				}
			}
			break
	}
}
function category(ctx){ // sets category for avatar
	ctx.state.category = ctx.request.body
	const { avatar, } = ctx.state
	avatar.setActiveCategory(ctx.state.category)
	ctx.body = avatar.category
}
/**
 * Challenge the member session with a passphrase.
 * @module
 * @public
 * @async
 * @api - No associated view
 * @param {Koa} ctx - Koa Context object
 * @returns {object} Koa Context object
 * @property {object} ctx.body - The result of the challenge.
 */
async function challenge(ctx){
	const { passphrase, } = ctx.request.body
	if(!passphrase?.length)
		ctx.throw(400, `challenge request requires passphrase`)
	const { mid, } = ctx.params
	if(!mid?.length)
		ctx.throw(400, `challenge request requires member id`)
	if(!ctx.state.MemberSession.locked)
		return true
	const challengeSuccessful = await ctx.MyLife.challengeAccess(mid, passphrase)
	const { MemberSession, } = ctx.session
	MemberSession.challengeOutcome = challengeSuccessful
	await MemberSession.init(mid)
	ctx.body = !MemberSession.locked
}
/**
 * Chat with the member's avatar.
 * @todo - deprecate threadId in favor of thread_id
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - The response from the chat in `ctx.body`
 * @property {object} instruction - Instructionset for the frontend to execute (optional)
 * @property {Object[]} responses - Response messages from Avatar intelligence
 */
async function chat(ctx){
	const { botId, itemId, message, shadowId, } = ctx.request.body ?? {} /* body nodes sent by fe */
	if(!message?.length)
			ctx.throw(400, 'missing `message` content')
	const { avatar, MemberSession, } = ctx.state
	const { isMyLife, thread_id, } = MemberSession
	let conversation
	if(isMyLife && !thread_id?.length){
		conversation = await avatar.createConversation('system', undefined, botId, true) // pushes to this.#conversations in Avatar
		MemberSession.thread_id = conversation.thread_id
	}
	const response = await avatar.chat(message, botId, MemberSession.thread_id, itemId, shadowId, conversation)
	ctx.body = response
}
async function collections(ctx){
	const { avatar, } = ctx.state
	ctx.body = await avatar.collections(ctx.params.type)
}
async function createBot(ctx){
	const { teamId, type, } = ctx.request.body
	const { avatar, } = ctx.state
	const bot = { teams: [], type, } // `type` only requirement to create a known, MyLife-typed bot
	if(teamId?.length)
		bot.teams.push(teamId)
	ctx.body = await avatar.createBot(bot)
}
/**
 * Delete an item from collection via the member's avatar.
 * @async
 * @public
 * @param {object} ctx - Koa Context object
 * @returns {boolean} - Under `ctx.body`, status of deletion.
 */
async function deleteItem(ctx){
	const { iid, } = ctx.params
	const { avatar, } = ctx.state
	if(!iid?.length)
		ctx.throw(400, `missing item id`)
	ctx.body = await avatar.deleteItem(iid)
}
/**
 * Get greetings for this bot/active bot.
 * @todo - move dynamic system responses to a separate function (route /system)
 * @param {Koa} ctx - Koa Context object.
 * @returns {object} - Greetings response message object: { success: false, messages: [], }.
 */
async function greetings(ctx){
	const { vld: validateId, } = ctx.request.query
	let { dyn: dynamic, } = ctx.request.query
	if(typeof dynamic==='string')
		dynamic = JSON.parse(dynamic)
	const { avatar, } = ctx.state
	let response = { success: false, messages: [], }
	if(validateId?.length)
		response.messages.push(...await avatar.validateRegistration(validateId))
	else
		response.messages.push(...await avatar.getGreeting(dynamic))
	response.success = response.messages.length > 0
	ctx.body = response
}
/**
 * Request help about MyLife.
 * @param {Koa} ctx - Koa Context object, body={ request: string|required, mbr_id, type: string, }.
 * @returns {object} - Help response message object.
 */
async function help(ctx){
	const { helpRequest, type=`general`, } = ctx.request?.body
	if(!helpRequest?.length)
		ctx.throw(400, `missing help request text`)
	const { avatar } = ctx.state
	const _avatar = type==='membership' ? avatar : ctx.MyLife.avatar
	ctx.body = await _avatar.help(helpRequest, type)
}
/**
 * Index page for the application.
 * @async
 * @public
 * @param {object} ctx - Koa Context object
 */
async function index(ctx){
	if(!ctx.state?.locked ?? true)
		ctx.redirect(`/members`) // Redirect to /members if authorized
	await ctx.render('index')
}
/**
 * Set or get the avatar interface mode for the member.
 * @module
 * @public
 * @api - No associated view
 * @param {object} ctx - Koa Context object
 * @returns {object} - Koa Context object
 * @property {string} ctx.body - The interface mode for the member.
 */
function interfaceMode(ctx){
	const { avatar, } = ctx.state
	if(ctx.method==='POST' && ctx.request.body.mode){
		avatar.mode = ctx.request.body.mode
	}
	ctx.body = avatar.mode
	return
}
async function item(ctx){
	const { iid: id, } = ctx.params
	const { avatar, } = ctx.state
	const { globals, } = avatar
	const { method, } = ctx.request
	const item = ctx.request.body
	/* validate payload */
	if(!id?.length)
		ctx.throw(400, `missing item id`)
	if(!item || typeof item !== 'object' || !Object.keys(item).length)
		ctx.throw(400, `missing item data`)
	const { id: itemId, } = item
	if(itemId && itemId!==id) // ensure item.id is set to id
		throw new Error(`item.id must match /:iid`)
	else if(!itemId)
		item.id = id
	ctx.body = await avatar.item(item, method)
}
async function logout(ctx){
	ctx.session = null
	ctx.redirect('/')
}
/**
 * Returns a member list for selection.
 * @todo: should obscure and hash ids in session.mjs
 * @todo: set and read long-cookies for seamless login
 * @param {Koa} ctx - Koa Context object
 * @returns {Object[]} - List of hosted members available for login.
 */
async function loginSelect(ctx){
	const { avatar, } = ctx.state
	ctx.body = await avatar.hostedMembers(process.env.MYLIFE_HOSTING_KEY)
}
async function members(ctx){ // members home
	await ctx.render('members')
}
async function migrateBot(ctx){
	const { bid, } = ctx.params
	const { avatar, } = ctx.state
	ctx.body = await avatar.migrateBot(bid)
}
async function migrateChat(ctx){
	const { tid, } = ctx.params
	const { avatar, } = ctx.state
	ctx.body = await avatar.migrateChat(tid)
}
/**
 * Given an itemId, obscures aspects of contents of the data record.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - The item obscured
 */
async function obscure(ctx){
	const { iid, } = ctx.params
	const { avatar, } = ctx.state
	ctx.body = await avatar.obscure(iid)
}
/**
 * Reset the passphrase for the member's avatar.
 * @param {Koa} ctx - Koa Context object
 * @returns {boolean} - Whether or not passpharase successfully reset
 */
async function passphraseReset(ctx){
	const { avatar, } = ctx.state
	if(avatar?.isMyLife ?? true)
		ctx.throw(400, `cannot reset system passphrase`)
	const { passphrase } = ctx.request.body
	if(!passphrase?.length)
		ctx.throw(400, `passphrase required for reset`)
	ctx.body = await avatar.resetPassphrase(passphrase)
}
/**
 * Display the privacy policy page - ensure it can work in member view.
 * @param {Koa} ctx - Koa Context object
 */
async function privacyPolicy(ctx){
	ctx.state.title = `MyLife Privacy Policy`
	ctx.state.subtitle = `Effective Date: 2024-01-01`
	await ctx.render('privacy-policy')	//	privacy-policy
}
/**
 * Direct request from member to retire a bot.
 * @param {Koa} ctx - Koa Context object
 */
async function retireBot(ctx){
	const { avatar, } = ctx.state
	const { bid, } = ctx.params // bot id
	if(!ctx.Globals.isValidGuid(bid))
		ctx.throw(400, `missing bot id`)
	const response = await avatar.retireBot(bid)
	ctx.body = response
}
/**
 * Direct request from member to retire a chat (via bot).
 * @param {Koa} ctx - Koa Context object
 */
async function retireChat(ctx){
	const { avatar, } = ctx.state
	const { bid, } = ctx.params
	if(!bid?.length)
		ctx.throw(400, `missing bot id`)
	const response = await avatar.retireChat(bid)
	ctx.body = response
}
/**
 * Gets the list of shadows.
 * @returns {Object[]} - Array of shadow objects.
 */
async function shadows(ctx){
	const { avatar, } = ctx.state
	const response = await avatar.shadows()
	ctx.body = response
}
async function signup(ctx) {
    const { avatarName, email, humanName, type='newsletter', } = ctx.request.body
	const signupPacket = {
		avatarName,
		email,
		humanName: humanName.substring(0, 64),
		type,
	}
	let success = false
	if(ctx.session.signup)
		ctx.throw(400, 'Invalid input', { 
			success,
			message: `session user already signed up`,
			payload: signupPacket,
		})
    if(!ctx.Globals.isValidEmail(email))
		ctx.throw(400, 'Invalid input', { 
			success,
			message: 'Invalid input: email',
			payload: signupPacket,
		})
    if(!humanName || humanName.length < 3)
		ctx.throw(400, 'Invalid input', { 
			success,
			message: 'Invalid input: First name must be between 3 and 64 characters: humanNameInput',
			payload: signupPacket,
		})
	if(( avatarName?.length < 3 ?? true ) && type==='register')
		ctx.throw(400, 'Invalid input', {
			success,
			message: 'Invalid input: Avatar name must be between 3 and 64 characters: avatarNameInput',
			payload: signupPacket,
		})
	signupPacket.id = ctx.MyLife.newGuid
	const registrationData = await ctx.MyLife.registerCandidate(signupPacket)
	console.log('signupPacket:', signupPacket, registrationData)
	ctx.session.signup = true
	success = true
	const { mbr_id, ..._registrationData } = signupPacket // do not display theoretical memberId
    ctx.status = 200 // OK
    ctx.body = {
		payload: _registrationData,
        success,
        message: 'Signup successful',
    }
}
async function summarize(ctx){
	const { avatar, } = ctx.state
	const { fileId, fileName, } = ctx.request.body
	if(avatar.isMyLife)
		throw new Error('Only logged in members may summarize text')
	ctx.body = await avatar.summarize(fileId, fileName)
}
/**
 * Get a specified team, its details and bots, by id for the member.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Team object
 */
async function team(ctx){
	const { tid, } = ctx.params
	if(!tid?.length)
		ctx.throw(400, `missing team id`)
	const { avatar, } = ctx.state
	ctx.body = await avatar.team(tid)
}
/**
 * Get a list of available teams and their default details.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Object[]} - List of team objects.
 */
function teams(ctx){
	const { avatar, } = ctx.state
	ctx.body = avatar.teams()
}
async function updateBotInstructions(ctx){
	const { botId, } = ctx.request.body
	const { avatar, } = ctx.state
	const bot = await avatar.updateBotInstructions(botId)
	ctx.body = {
		bot,
		success: !!bot,
	}
}
/**
 * Proxy for uploading files to the API.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - The result of the upload as `ctx.body`.
 */
async function upload(ctx){
	const { avatar, } = ctx.state
	if(avatar.isMyLife)
		throw new Error('Only logged in members may upload files')
	ctx.session.APIMemberKey = avatar.mbr_id
	ctx.session.isAPIValidated = true
	await apiUpload(ctx)
}
/* exports */
export {
	about,
	activateBot,
	alerts,
	bots,
	category,
	challenge,
	chat,
	collections,
	createBot,
	deleteItem,
	help,
	greetings,
	index,
	interfaceMode,
	item,
	logout,
	loginSelect,
	members,
    migrateBot,
    migrateChat,
	obscure,
	passphraseReset,
	privacyPolicy,
	retireBot,
	retireChat,
	shadows,
	signup,
	summarize,
	team,
	teams,
	updateBotInstructions,
	upload,
}