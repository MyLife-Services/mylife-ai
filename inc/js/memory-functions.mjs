/* imports */
import { 
	activateBot,
	upload,
} from './functions.mjs'
/* module export functions */
async function collectMemory(ctx){
	// @todo - implement memory collection
}
async function endMemory(ctx){
	const { iid, } = ctx.params
	const { Globals, MyLife, } = ctx
	if(!Globals.isValidGuid(iid))
		return ctx.throw(400, 'Invalid Item ID')
	const { avatar, } = ctx.state
	ctx.body = await avatar.endMemory(iid)
}
async function improveMemory(ctx){
	const { iid, } = ctx.params
	const { Globals, MyLife, } = ctx
	if(!Globals.isValidGuid(iid))
		return ctx.throw(400, 'Invalid Item ID')
	const { avatar, } = ctx.state
	const { memberInput, } = ctx.request.body
	ctx.body = await avatar.reliveMemory(iid, memberInput)
}
/**
 * Reliving a memory is a unique MyLife `experience` that allows a user to relive a memory from any vantage they choose. The bot by default will:
 * @param {Koa} ctx - Koa context object.
 * @returns {Promise<object>} - livingMemory engagement object (i.e., includes frontend parameters for engagement as per instructions for included `portrayMemory` function in LLM-speak) 
 */
async function reliveMemory(ctx){
	const { iid } = ctx.params
	const { Globals, MyLife, } = ctx
	if(!Globals.isValidGuid(iid))
		return ctx.throw(400, 'Invalid Item ID')
	const { avatar, } = ctx.state
	const { memberInput, } = ctx.request.body
	ctx.body = await avatar.reliveMemory(iid, memberInput)
}
/**
 * Living a shared memory is a unique MyLife `experience` that allows a user to relive a memory from any vantage the "author/narrator" chooses. In fact, much of the triggers and dials on how to present the experience of a shared memory is available and controlled by the member, and contained and executed by the biographer bot for the moment through this func6ion. Ultimately the default bot could be switched, in which case, information retrieval may need ways to contextualize pushbacks (floabt, meaning people asking questions about the memory that are not answerable by the summar itself, and 1) _may_ be answerable by another bot, such as biogbot, or 2) is positioned as a piece of data to "improve" or flesh out memories... Remember on this day in 2011, what did you have to eat on the boardwalk? Enquiring minds want to know!)
 * @param {Koa} ctx - Koa context object.
 * @returns {Promise<object>} - livingMemory object.
 */
async function livingMemory(ctx){
	const { iid } = ctx.params
	const { Globals, MyLife, } = ctx
	const { avatar, } = ctx.state
	if(!Globals.isValidGuid(iid))
		ctx.throw(400, 'Invalid Item ID')
	ctx.throw(501, 'Not Implemented')
	ctx.body = await avatar.livingMemory(iid)
}
/* exports */
export {
    collectMemory,
    improveMemory,
	endMemory,
    reliveMemory,
}