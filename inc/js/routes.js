// imports
import Router from 'koa-router'
// variables
const router = new Router()
//	system routes
router.get(
	'MemberSession',
	'/getMemberSession',
	ctx => {
		ctx.body = ctx.state.mylifeMemberCoreData
	}
)
//	exports
export { router }