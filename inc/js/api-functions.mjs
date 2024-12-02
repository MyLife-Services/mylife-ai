import chalk from "chalk"
/* variables */
const mBotSecrets = JSON.parse(process.env.OPENAI_JWT_SECRETS)
/* public module functions */
/**
 * Returns all publicly-available experiences.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Object[]} - Array of Experience Objects.
 */
async function availableExperiences(ctx){
    const { mbr_id } = ctx.state.avatar
    const experiences = await ctx.MyLife.availableExperiences()
    const autoplay = experiences
        .find(experience=>experience.autoplay) // find first (of any) autoplay experience
        ?.id
        ?? false
    ctx.body = {
        autoplay,
        experiences: experiences,
        mbr_id,
    }
}
async function entry(ctx){
    await mAPIKeyValidation(ctx)
    const { assistantType, mbr_id } = ctx.state
    if(!ctx.request.body?.summary?.length)
        throw new Error('No entry summary provided. Use `summary` field.')
    const summary = {
        ...ctx.request.body,
        assistantType,
        mbr_id,
    }
    const entry = await ctx.MyLife.entry(summary)
    ctx.status = 200
    ctx.body = {
        id: entry.id,
        message: 'entry submitted successfully.',
        success: true,
    }

}
// @todo implement builder functionality, allowing for interface creation of experiences by members
// @todo implement access to exposed member experiences using `mbr_key` as parameter to `factory.getItem()`
async function experienceBuilder(ctx){
    await mAPIKeyValidation(ctx)
    const { assistantType, mbr_id } = ctx.state
    const { eid, sid } = ctx.params
    const { experience } = ctx.request.body?.experience
    if(!experience)
        ctx.throw(400, 'No experience provided for builder. Use `experience` field.')
}
/**
 * Returns cast of an experience. Cast is the array of characters and other entities that are part of the experience.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Object[]} - Array of Cast Objects.
 * @property {array} cast - Experience cast array.
 * @property {object} navigation - Navigation object (optional - for interactive display purposes only).
 */
async function experienceCast(ctx){
    await mAPIKeyValidation(ctx)
    const { avatar: Avatar, } = ctx.state
    const { xid, } = ctx.params
    ctx.body = Avatar.manifest(xid)?.cast
}
/**
 * Conducts active Living-Experience for member. Passes data to avatar to manages the start, execution and completion of a member experience. Note: ctx.request.body is free JSON in order to tolerate a number of success/failure conditions.
 * @param {Koa} ctx - Koa Context object. **note** `ctx.request.body` is free JSON parsed by intelligence
 * @returns {Promise<object>} - Promise object represents object with following properties.
 * @property {boolean} success - Success status.
 * @property {array} events - Array of next Event(s).
 * @property {object} scene - Scene data, regardless if "current" or new.
 */
async function experience(ctx){
    await mAPIKeyValidation(ctx)
    const { avatar: Avatar, } = ctx.state
    const { xid, } = ctx.params
    const memberInput = ctx.request.body
    console.log('api-functions::experience()', memberInput, xid)
    ctx.body = await Avatar.experience(xid, memberInput)
}
/**
 * Request to end an active Living-Experience for member.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Object} - Represents `ctx.body` object with following `experience` properties.
 * @property {boolean} success - Success status, true/false.
 */
async function experienceEnd(ctx){
    await mAPIKeyValidation(ctx)
    const { avatar: Avatar, } = ctx.state
    const { xid, } = ctx.params
    ctx.body = Avatar.experienceEnd(xid)
}
/**
 * Delivers the manifest of an experience. Manifests are the data structures that define the experience, including scenes, events, and other data. Experience must be "started" in order to request.
 * @todo - if scripts should require skipping to _otherwise_ "invisible" scenes/events, then disclaimer should register front-end navigation required, for now, demand by consent agreement to provide mechanics for accessibility.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Object} - Represents `ctx.body` object with following `manifest` properties.
 * @property {Array} cast - Experience cast array.
 * @property {Object} navigation - Navigation object (optional - for interactive display purposes only).
 */
async function experienceManifest(ctx){
    await mAPIKeyValidation(ctx)
    const { avatar: Avatar, } = ctx.state
    const { xid, } = ctx.params
    ctx.body = Avatar.manifest(xid)
}
/**
 * Navigation array of scenes for experience.
 */
async function experienceNavigation(ctx){
    await mAPIKeyValidation(ctx)
    const { avatar: Avatar, } = ctx.state
    const { xid, } = ctx.params
    ctx.body = Avatar.manifest(xid)?.navigation
}
/**
 * Returns experiences relevant to member. If first request of session, will return mandatory system experience, if exists **and begin executing it**! On subsequent requests, just returns experiences.
 * @param {Koa} ctx - Koa Context object.
 * @returns {Promise<object>} - Promise object represents `ctx.body` object with following properties.
 * @property {string<Guid>} autoplay - Autoplay Experience with this id.
 * @property {array} experiences - Array of Experience shorthand objects.
 */
async function experiences(ctx){
    await mAPIKeyValidation(ctx)
    const { avatar: Avatar, } = ctx.state
    const experiencesObject = await Avatar.experiences()
    ctx.body = experiencesObject
}
async function experiencesLived(ctx){
    await mAPIKeyValidation(ctx)
    const { avatar: Avatar, } = ctx.state
    ctx.body = Avatar.experiencesLived
}
/**
 * Validates member key and returns member data. Leverages the key validation structure to ensure payload is liegimate. Currently in use by OpenAI GPT and local Postman instance.
 * @param {Koa} ctx - Koa Context object
 * @returns {object} - Object with following properties.
 * @property {boolean} success - Success status.
 * @property {string} message - Message to querying intelligence.
 * @property {object} data - Consented Member data.
 */
async function keyValidation(ctx){
    await mAPIKeyValidation(ctx)
    ctx.status = 200 // OK
    if(ctx.method === 'HEAD') return
    const { mbr_id } = ctx.state
    // @todo - may not reflect data core any longer
    const memberCore = await ctx.MyLife.datacore(mbr_id)
    const { updates, interests, birth: memberBirth, birthDate: memberBirthDate, fullName, names, nickname } = memberCore
    const birth = (Array.isArray(memberBirth) && memberBirth.length)
        ? memberBirth[0]
        : memberBirth ?? {}
    birth.date = memberBirthDate ?? birth.date
    birth.place = birth.place
    const memberCoreData = {
        mbr_id,
        updates,
        interests,
        birthDate: birth.date,
        birthPlace: birth.place,
        fullName: fullName ?? names?.[0] ?? 'unknown member',
        preferredName: nickname
            ?? names?.[0].split(' ')[0]
            ?? '',
    }
    console.log(chalk.yellowBright(`keyValidation()::`), chalk.redBright(`success::`), chalk.redBright(memberCoreData.mbr_id))
    ctx.body = {
        success: true,
        message: 'Valid Member',
        data: memberCoreData,
    }
}
/**
 * Logout function for member.
 * @param {Koa} ctx - Koa Context object
 * @returns 
 */
async function logout(ctx){
    ctx.session = null
    ctx.status = 200
    ctx.body = { success: true }
}
/**
 * Registration function for new members.
 * @todo - throttle register requests to prevent abuse.
 * @param {Koa} ctx - Koa Context object
 * @returns {Koa} Koa Context object
 */
async function register(ctx){
	const registrationData = ctx.request.body
    const { avatar, } = ctx.state
	const {
		registrationInterests,
		contact={}, // as to not elicit error destructuring
		personalInterests,
		additionalInfo
	} = registrationData
	const {
		avatarName,
		humanName,
		humanDateOfBirth,
		email,
		city,
		state,
		country,
	} = contact
	if (!humanName?.length || !email?.length)
        ctx.throw(400, 'Missing required contact information: humanName and/or email are required.')
	// Email validation
    if (!ctx.Globals.isValidEmail(contact.email))
        ctx.throw(400, 'Invalid email format.')
	registrationData.email = email // required at root for select
	const registration = await avatar.registerCandidate(registrationData)
	ctx.status = 200
    ctx.body = {
        success: true,
        message: 'Registration completed successfully.',
		data: registration,
    }
}
/**
 * Functionality around story contributions.
 * @param {Koa} ctx - Koa Context object
 */
async function memory(ctx){
    await mAPIKeyValidation(ctx) // sets ctx.state.mbr_id and more
    const { assistantType, mbr_id } = ctx.state
    if(!ctx.request.body?.summary?.length)
        throw new Error('No memory summary provided. Use `summary` field.')
    const summary = {
        ...ctx.request.body,
        assistantType,
        mbr_id,
    }
    const memory = await ctx.MyLife.memory(summary)
    ctx.status = 200
    ctx.body = {
        id: memory.id,
        message: 'memory submitted successfully.',
        success: true,
    }
}
/**
 * Given an itemId, obscures aspects of contents of the data record.
 * @param {Koa} ctx - Koa Context object
 * @returns {Promise<object>} - Promise object representing obscured item
 */
async function obscure(ctx){
    await mAPIKeyValidation(ctx)
    const { itemId: iid, } = ctx.request?.body ?? {}
    if(!ctx.Globals.isValidGuid(iid))
        ctx.throw(400, 'Improper `itemId` provided in request')
    const { avatar, mbr_id, } = ctx.state
    ctx.body = await avatar.obscure(mbr_id, iid)
}
/**
 * Validates api token.
 * @module
 * @public
 * @param {object} ctx Koa context object
 * @param {function} next Koa next function
 * @returns {function} Koa next function
 */
async function tokenValidation(ctx, next){
    try {
        const authHeader = ctx.request.headers['authorization']
        if(!authHeader){
            ctx.status = 401
            ctx.body = { error: 'Authorization header is missing' }
            return
        }
        const token = authHeader.split(' ')[1] // Bearer TOKEN_VALUE
        if(!mTokenValidation(token)){
            ctx.status = 401
            ctx.body = { error: 'Authorization token failure' }
            return
        }
        ctx.state.token = token // **note:** keep first, as it is used in mTokenType()
        ctx.state.assistantType = mTokenType(ctx)
        await next()
    }  catch (error) {
        ctx.status = 401
        const _error = {
            name: error.name,
            message: error.message,
            stack: error.stack
        }
        ctx.body = { message: 'Unauthorized Access', error: _error }
        return
    }
}
async function upload(ctx){
    const { body, files: filesWrapper, } = ctx.request
    const { type } = body
    let files = filesWrapper['files[]'] // protocol for multiple files in `ctx.request`
    if(!files)
        ctx.throw(400, 'No files uploaded.')
    if(!Array.isArray(files))
        files = [files]
    await mAPIKeyValidation(ctx)
    const { avatar, } = ctx.state
    const upload = await avatar.upload(files)
    upload.type = type
    upload.message = `File(s) [type=${ type }] attempted upload, see "success".`,
    ctx.body = upload
}
/* "private" module functions */
/**
 * Validates key and sets `ctx.state` and `ctx.session` properties. `ctx.state`: [ assistantType, isValidated, mbr_id, ]. `ctx.session`: [ isAPIValidated, APIMemberKey, ].
 * @module
 * @private
 * @async
 * @param {Koa} ctx - Koa Context object.
 * @returns {Promise<void>}
 */
async function mAPIKeyValidation(ctx){ // transforms ctx.state
    if(ctx.params.mid === ':mid')
        ctx.params.mid = undefined
    const memberId = ctx.params?.mid
        ??  ctx.request.body?.mbr_id
        ??  ctx.request.body?.memberKey
        ??  ctx.session?.APIMemberKey
    if(!memberId?.length)
        if(ctx.state.locked)
            ctx.throw(400, 'Missing member key.')
        else // unlocked, providing passphrase
            return
    if( // validated
            !ctx.state.locked
        ||  ( ctx.session.isAPIValidated ?? false )
        ||  await ctx.MyLife.isMemberHosted(memberId)
    ){
        ctx.state.isValidated = true
        ctx.state.mbr_id = memberId
        ctx.state.assistantType = mTokenType(ctx)
        ctx.session.isAPIValidated = ctx.state.isValidated
        ctx.session.APIMemberKey = ctx.state.mbr_id
    }
}
function mTokenType(ctx){
    const { token, } = ctx.state
    const assistantType = mBotSecrets?.[token] ?? 'personal-avatar'
    return assistantType
}
function mTokenValidation(token){
    return mBotSecrets?.[token]?.length??false
}
/* exports */
export {
    availableExperiences,
    entry,
    experience,
    experienceCast,
    experienceEnd,
    experienceManifest,
    experienceNavigation,
    experiences,
    experiencesLived,
    keyValidation,
    logout,
    memory,
    obscure,
    register,
    tokenValidation,
    upload,
}