import { EventEmitter } from 'events'
import chalk from 'chalk'
class MylifeMemberSession extends EventEmitter {
	#alertsShown = [] // array of alert_id's shown to member in this session
	#autoplayed = false // flag for autoplayed experience, one per session
	#consents = []	//	consents are stored in the session
	#contributions = []	//	intended to hold all relevant contribution questions for session
	#experiences = []	//	holds id for experiences conducted in this session
	#factory
	#locked = true	//	locked by default
	#mbr_id = false
	#Member
	name
	constructor(_factory){
		super()
		this.#factory = _factory
		this.#mbr_id = this.isMyLife ? this.factory.mbr_id : false
		mAssignFactoryListeners(this.#factory)
		console.log(
			chalk.bgGray('MylifeMemberSession:constructor(_factory):generic-mbr_id::end'),
			chalk.bgYellowBright(this.factory.mbr_id),
		)
	}
	async init(mbr_id=this.mbr_id){
		if(this.locked){
			if(this.#Member?.mbr_id??mbr_id !== mbr_id)
				console.log(chalk.bgRed('cannot initialize, member locked'))
		}
		if(this.mbr_id && this.mbr_id !== mbr_id) { // unlocked, initialize member session
			this.#mbr_id = mbr_id
			mAssignFactoryListeners(this.#factory)
			await this.#factory.init(this.mbr_id, )	//	needs only `init()` with different `mbr_id` to reset
			this.#Member = await this.factory.getMyLifeMember()
			this.#autoplayed = false // resets autoplayed flag, although should be impossible as only other "variant" requires guest status, as one day experiences can be run for guests also [for pay]
			this.emit('onInit-member-initialize', this.#Member.memberName)
			console.log(
				chalk.bgBlue('created-member:'),
				chalk.bgRedBright(this.#Member.memberName)
			)
		}
		return this
	}
	async alert(_alert_id){
		return this.factory.getAlert(_alert_id)
	}
	async alerts(_type){
		let currentAlerts = this.factory.alerts
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
	async challengeAccess(_passphrase){
		if(this.locked){
			if(!this.challenge_id) return false	//	this.challenge_id imposed by :mid from route
			if(!await this.factory.challengeAccess(this.challenge_id, _passphrase)) return false	//	invalid passphrase, no access [converted in this build to local factory as it now has access to global datamanager to which it can pass the challenge request]
			//	init member
			this.#locked = false
			this.emit('member-unlocked', this.challenge_id)
			await this.init(this.challenge_id)
		}
		return !this.locked
	}
	/**
	 * Gets experiences for the member session. Identifies if autoplay is required, and if so, begins avatar experience via this.#Member. Ergo, Session can request avatar directly from Member, which was generated on `.init()`.
	 * @todo - get and compare list of lived-experiences
	 * @param {boolean} includeLived - Include lived experiences in the list.
	 * @returns {Promise<object>} - Experiences shorthand: { autoplay: guid??false, events: [], experiences: [] }
	 * @property {Guid} autoplay - Autoplay experience id.
	 * @property {Object[]} events - Array of events.
	 * @property {Object[]} experiences - Array of experiences.
	 */
	async experiences(includeLived=false){
		if(this.locked) return {}
		const { avatar } = this.#Member
		const experiences = await avatar.experiences(includeLived)
		let autoplay = experiences
            ?.find(experience=>experience.autoplay)
			?.id
			?? false
		let events = []
		/* trigger auto-play from session */
		if(!this.#autoplayed && this.globals.isValidGuid(autoplay)){
            const _start = await avatar.experienceStart(autoplay)
			this.#autoplayed = true
			console.log('autoplay triggered', _start)
        }
		return { autoplay, experiences, mbr_id: this.mbr_id }
	}
	//	consent functionality
	async requestConsent(ctx){
		//	validate request; switch true may be required
		if(!mValidCtxObject(ctx)) return false	//	invalid ctx object, consent request fails
		//	check-01: url ends in valid guid /:_id
		const _object_id = ctx.request.header?.referer?.split('/').pop()
		//	not guid, not consent request, no blocking
		if(!this.globals.isValidGuid(_object_id)) return true
		console.log('session.requestConsent()', 'mbr_id', this.mbr_id)
		//	ultimately, applying a disposable agent of intelligence to consent request might be the answer
		let _consent = this.consents
			.filter(_=>{ return _.id==_object_id })
			.pop()
		if(!_consent){
			//	create and notify session
			_consent = await this.factory.getConsent({
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
		return this.factory.requestConsent(_consent_id,_request)
		
		if(!this?.ctx?.session?.MemberSession?.consents) return	//	pre-natal instance of MyLife?
		//	otherwise, should be able to construe
		_consent = (_consent_id)
			?	{}	//	retrieve from Cosmos
			:	new (this.schemas.consent)(_request, this)	//	generate new consent
		console.log('_consent', _consent)
		//	manipulate session through ctx (although won't exist in initial test case)
		await (this.ctx.session.MemberSession.consents = _consent)	//	will add consent to session list
		return _consent
	}
	get consent(){
		return this.factory.consent	//	**caution**: returns <<PROMISE>>
	}
	set consent(_consent){
		this.#consents.unshift(_consent)
	}
	get consents(){
		return this.#consents
	}
	get contributions(){
		return this.#contributions
	}
	get core(){
		return this.factory.core
	}
	get factory(){
		return this.#factory
	}
	get globals(){
		return this.factory.globals
	}
	get isInitialized(){
		return ( this.mbr_id!==false )
	}
	get isMyLife(){
		return this.factory.isMyLife
	}
	get locked(){
		return this.#locked
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
	get subtitle(){
		return this.#Member?.agentName
	}
}
function mAssignFactoryListeners(_session){
	if(_session.isMyLife) // all sessions _begin_ as MyLife
		_session.factory.on('member-unlocked',_mbr_id=>{
			console.log(
				chalk.grey('session::constructor::member-unlocked_trigger'),
				chalk.bgGray(_mbr_id)
			)
		})
	else // all _"end"_ as member
		_session.factory.on('avatar-activated',_avatar=>{
			console.log(
				chalk.grey('session::constructor::avatar-activated_trigger'),
				chalk.bgGray(_avatar.id)
			)
		})
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