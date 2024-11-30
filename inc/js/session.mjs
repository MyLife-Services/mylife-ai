import { EventEmitter } from 'events'
import chalk from 'chalk'
class MylifeMemberSession extends EventEmitter {
	#alertsShown = [] // array of alert_id's shown to member in this session
	#consents = []	//	consents are stored in the session
	#factory
	#mbr_id = false
	#Member
	name
	#sessionLocked = true // locked by default
	constructor(factory){
		super()
		this.#factory = factory
		this.#mbr_id = this.isMyLife ? this.#factory.mbr_id : false
	}
	/**
	 * Initializes the member session. If `isMyLife`, then session requires chat thread unique to visitor; session has singleton System Avatar who maintains all running Conversations.
	 * @param {String} mbr_id - Member id to initialize session
	 * @returns {Promise<MylifeMemberSession>} - Member session instance
	 */
	async init(mbr_id=this.mbr_id){
		if(!this.locked && this.mbr_id && this.mbr_id!==mbr_id){ // unlocked, initialize member session
			this.#mbr_id = mbr_id
			await this.#factory.init(this.mbr_id) // needs only `init()` with different `mbr_id` to reset
			this.#Member = await this.#factory.getMyLifeMember()
			delete this.Conversation
			delete this.thread_id
			console.log(chalk.bgBlue('created-member:'), chalk.bgRedBright(this.#Member.memberName))
		}
		return this
	}
	async alert(_alert_id){
		return this.#factory.getAlert(_alert_id)
	}
	async alerts(_type){
		let currentAlerts = this.#factory.alerts
		// remove alerts already shown to member in this session
		currentAlerts = currentAlerts
			.filter(_alert=>{
				return !this.#alertsShown.includes(_alert.id)
			})
		currentAlerts.forEach(_alert=>{
			this.#alertsShown.push(_alert.id)
		})
		return currentAlerts
	}
	//	consent functionality
	async requestConsent(ctx){
		//	validate request; switch true may be required
		if(!mValidCtxObject(ctx))
			return false	//	invalid ctx object, consent request fails
		//	check-01: url ends in valid guid /:_id
		const _object_id = ctx.request.header?.referer?.split('/').pop()
		//	not guid, not consent request, no blocking
		if(!this.globals.isValidGuid(_object_id)) return true
		//	ultimately, applying a disposable agent of intelligence to consent request might be the answer
		let _consent = this.consents
			.filter(_=>{ return _.id==_object_id })
			.pop()
		if(!_consent){
			//	create and notify session
			_consent = await this.#factory.getConsent({
				id: _object_id,
				mbr_id: this.mbr_id,
				being: 'consent',
				context: `This consent object was created by MyLife Session [${this.mbr_id}] to manage access to asset [${_object_id}] of owner [${this.mbr_id}].`,
				purpose: `To manage requested access to the underlying avatar or object according to the wills and expressions of the member identified by their mbr_id: ${this.mbr_id}.`,
			})
			this.consents.unshift(_consent)
		}
		return _consent.allow()	//	might benefit from putting consent into openai assistant metadata with suggestion to adhere when creating content
		if(!ctx.request.body) return	//	nothing to do
		//	based on incoming request, parse out consent id and request
		return this.#factory.requestConsent(_consent_id,_request)
		
		if(!this?.ctx?.session?.MemberSession?.consents) return	//	pre-natal instance of MyLife?
		//	otherwise, should be able to construe
		_consent = (_consent_id)
			?	{}	//	retrieve from Cosmos
			:	new (this.schemas.consent)(_request, this)	//	generate new consent
		//	manipulate session through ctx (although won't exist in initial test case)
		await (this.ctx.session.MemberSession.consents = _consent)	//	will add consent to session list
		return _consent
	}
	/* getters and setters */
	get avatar(){
		return this.#Member.avatar
	}
	/**
	 * @param {boolean} outcome - The challenge outcome; `true` was successful
	 */
	set challengeOutcome(outcome){
		if(outcome)
			this.#sessionLocked = false
	}
	get consent(){
		return this.#factory.consent	//	**caution**: returns <<PROMISE>>
	}
	set consent(_consent){
		this.#consents.unshift(_consent)
	}
	get consents(){
		return this.#consents
	}
	get globals(){
		return this.#factory.globals
	}
	get isInitialized(){
		return ( this.mbr_id!==false )
	}
	get isMyLife(){
		return this.#factory.isMyLife
	}
	get locked(){
		return this.sessionLocked
	}
	get mbr_id(){
		return this.#mbr_id
	}
	get mbr_id_id(){
		return this.globals.sysId( this.mbr_id )
	}
	get member(){ // @todo - deprecate and funnel through any requests
		return this.#Member
	}
	get sessionLocked(){
		return this.#sessionLocked
	}
	get subtitle(){
		return this.#Member?.agentName
	}
}
function mValidCtxObject(_ctx){
	//	validate ctx object
	return	(
			_ctx
		&&	typeof _ctx === 'object'
		&&	'request' in _ctx 
		&&	'response' in _ctx
		&&	'session' in _ctx
		&&	'state' in _ctx
	)
}
export default MylifeMemberSession