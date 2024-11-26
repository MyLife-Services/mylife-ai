/* imports */
import {
	upload as apiUpload,
} from './api-functions.mjs'
/* module export functions */
/**
 * Renders the about page for the application. Visitors see the rendered page, members see the page as responses from their Avatar.
 * @param {Koa} ctx - Koa Context object
 * @returns {object|void} - Renders page in place (visitor) or Koa Context object (member)
 */
async function about(ctx){
	if(ctx.state.locked){
		ctx.state.title = `About MyLife`
		await ctx.render('about')
	} else {
		const { avatar: Avatar, } = ctx.state
		const response = await Avatar.routine('about')
		ctx.body = response
	}
}
/**
 * Activate a specific Bot.
 * @public
 * @async
 * @param {object} ctx - Koa Context object
 * @returns {object} - Activated Response object: { bot_id, greeting, success, version, versionUpdate, }
 */
async function activateBot(ctx){
	const { bid, } = ctx.params
	if(!ctx.Globals.isValidGuid(bid))
		ctx.throw(400, `missing bot id`)
	const { avatar: Avatar, } = ctx.state
	const response =await Avatar.setActiveBot(bid)
	ctx.body = response
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
/**
 * Manage bots for the member.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Koa Context object
 */
async function bots(ctx){
	const { bid, } = ctx.params // bot_id sent in url path
	const { avatar: Avatar, } = ctx.state
	const bot = ctx.request.body
		?? {}
	switch(ctx.method){
		case 'DELETE': // retire bot
			if(!ctx.Globals.isValidGuid(bid))
				ctx.throw(400, `missing bot id`)
			ctx.body = await Avatar.retireBot(bid)
			break
		case 'POST': // create new bot
			ctx.body = await Avatar.createBot(bot)
			break
		case 'PUT': // update bot
			ctx.body = await Avatar.updateBot(bot)
			break
		case 'GET':
		default:
			if(bid?.length){ // specific bot
				ctx.body = await Avatar.getBot(ctx.params.bid)
			} else {
				const bots = await Avatar.getBots()
				let { activeBotId, greeting, } = Avatar
				if(!activeBotId){
					const { bot_id, greeting: activeGreeting } = await Avatar.setActiveBot()
					activeBotId = bot_id
					greeting = activeGreeting
				}
				ctx.body = { // wrap bots
					activeBotId,
					bots,
					greeting,
				}
			}
			break
	}
}
/**
 * Challenge the member session with a passphrase.
 * @public
 * @async
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Koa Context object
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
 * Chat with the Member or System Avatar's intelligence.
 * @public
 * @async
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - The response from the chat in `ctx.body`
 * @property {object} instruction - Instructionset for the frontend to execute (optional)
 * @property {Object[]} responses - Response messages from Avatar intelligence
 */
async function chat(ctx){
	const { botId: bot_id, itemId, message, } = ctx.request.body
		?? {} /* body nodes sent by fe */
	if(!message?.length)
			ctx.throw(400, 'missing `message` content')
	const { avatar, } = ctx.state
	const session = avatar.isMyLife
		? ctx.session.MemberSession
		: null
	if(bot_id?.length && bot_id!==avatar.activeBotId)
		throw new Error(`Bot ${ bot_id } not currently active; chat() requires active bot`)
	const response = await avatar.chat(message, itemId, session)
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
 * Given an itemId, evaluates aspects of contents of the data record.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - The evaluation ersponse
 */
async function evaluate(ctx){
	const { iid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	ctx.body = await Avatar.evaluate(iid)
}
/**
 * Save feedback from the member.
 * @param {Koa} ctx - Koa Context object
 * @returns {Boolean} - Whether or not the feedback was saved
 */
async function feedback(ctx){
	const { mid: message_id, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	const { isPositive=true, message, } = ctx.request.body
	ctx.body = await Avatar.feedback(message_id, isPositive, message)
}
/**
 * Get greetings for active situation.
 * @public
 * @async
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Greetings response message object: { responses, success, }
 */
async function greetings(ctx){
	const { vld: validateId, } = ctx.request.query
	let { dyn: dynamic, } = ctx.request.query
	if(typeof dynamic==='string')
		dynamic = JSON.parse(dynamic)
	const { avatar: Avatar, } = ctx.state
	const response = validateId?.length && Avatar.isMyLife
		? await Avatar.validateRegistration(validateId)
		: await Avatar.greeting(dynamic)
	ctx.body = response
}
/**
 * Request help about MyLife.
 * @public
 * @async
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
 * @public
 * @async
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
	const item = ctx.request.body // always `{}` by default
	if(!item?.id && id?.length)
		item.id = id
	const response = await avatar.item(item, method)
	delete avatar.frontendInstruction
	ctx.body = response
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
	const { bid, } = ctx.params
	const { avatar, } = ctx.state
	ctx.body = await avatar.migrateChat(bid)
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
	if(ctx.state.locked){
		ctx.state.title = `MyLife Privacy Policy`
		await ctx.render('privacy-policy')
	} else {
		const { avatar: Avatar, } = ctx.state
		const response = await Avatar.routine('privacy')
		ctx.body = response
	}
}
/**
 * Direct request from member to retire a bot.
 * @param {Koa} ctx - Koa Context object
 */
async function retireBot(ctx){
	ctx.method = 'DELETE'
	return await this.bots(ctx)
}
/**
 * Direct request from member to retire a chat (via bot).
 * @param {Koa} ctx - Koa Context object
 */
async function retireChat(ctx){
	const { avatar: Avatar, } = ctx.state
	const { bid, } = ctx.params
	if(!bid?.length)
		ctx.throw(400, `missing bot id`)
	const response = await Avatar.retireChat(bid)
	ctx.body = response
}
/**
 * Routines are pre-composed scripts that can be run on-demand. They animate HTML content formatted by <section>.
 * @param {Koa} ctx - Koa Context object
 */
async function routine(ctx){
	const { rid, } = ctx.params
	const { avatar: Avatar, } = ctx.state
	const response = await Avatar.routine(rid)
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
		message: 'Signup successful',
		payload: _registrationData,
        success,
    }
}
async function summarize(ctx){
	const { avatar: Avatar, } = ctx.state
	const { fileId, fileName, } = ctx.request.body
	ctx.body = await Avatar.summarize(fileId, fileName)
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
async function teams(ctx){
	const { avatar: Avatar, } = ctx.state
	ctx.body = await Avatar.teams()
}
async function updateBotInstructions(ctx){
	const { bid, } = ctx.params
	if(!bid?.length)
		ctx.throw(400, `missing bot id`)
	const { avatar, } = ctx.state
	const bot = await avatar.updateBotInstructions(bid)
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
	challenge,
	chat,
	collections,
	createBot,
	evaluate,
	feedback,
	greetings,
	help,
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
	routine,
	shadows,
	signup,
	summarize,
	team,
	teams,
	updateBotInstructions,
	upload,
}