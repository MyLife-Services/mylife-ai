//	*imports
import { abort } from 'process'
//	native node [less dotenv => azure web app]
import path from 'path'
import { fileURLToPath } from 'url'
//	server
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import render from 'koa-ejs'
import session from 'koa-generic-session'
//	import Router from 'koa-router'
//	misc
import chalk from 'chalk'
//	local services
import Globals from './inc/js/globals.js'
//	dotenv
import koaenv from 'dotenv'
koaenv.config()
//	constants/variables
const app = new Koa()
const port = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MemoryStore = new session.MemoryStore()
const _Globals = await new Globals()
	.init()
//	Maht Singleton for server scope
const _Maht = await _Globals.getServer(process.env.MYLIFE_SERVER_MBR_ID)
const serverRouter = await _Maht.router
console.log(chalk.bgBlue('created-core-entity:', chalk.bgRedBright('MAHT')))
//	koa-ejs
render(app, {
	root: path.join(__dirname, 'views'),
	layout: 'layout',
	viewExt: 'html',
	cache: false,
	debug: false,
})
//	default root routes
//	app bootup
//	app context (ctx) modification
app.context.MyLife = _Maht
app.keys = [`${process.env.MYLIFE_SESSION_KEY}`]
//	app definition
app.use(bodyParser())	//	enable body parsing
	.use(
		session(	//	session initialization
			{
				key: 'mylife.sid',   // cookie session id
				maxAge: process.env.MYLIFE_SESSION_TIMEOUT_MS,     // session lifetime in milliseconds
				autoCommit: true,
				overwrite: true,
				httpOnly: false,
				signed: true,
				rolling: false,
				renew: false,
				store: MemoryStore,
			},
			app
		))
	.use(async (ctx,next) => {	//	SESSION: member login
		//	systen context
		if(!ctx.session?.MemberSession) ctx.session.MemberSession = new (_Globals.schemas.session)(JSON.parse(process.env.MYLIFE_HOSTED_MBR_ID)[0], _Maht.challengeAccess.bind(_Maht))	//	inject functionality into session object
		ctx.state.board = ctx.MyLife.boardListing	//	array of plain objects by full name
		ctx.state.menu = _Maht.menu
		ctx.state.blocked = ctx.session.MemberSession.locked
		ctx.state.hostedMembers = JSON.parse(process.env.MYLIFE_HOSTED_MBR_ID)	//	array of mbr_id
		ctx.state.member = ctx.session.MemberSession?.member
		ctx.state.agent = ctx.state.member?.agent
		await next()
	})
//	.use(MyLifeMemberRouter.routes())	//	enable member routes
//	.use(MyLifeMemberRouter.allowedMethods())	//	enable member routes
	.use(serverRouter.routes())	//	enable system routes
	.use(serverRouter.allowedMethods())	//	enable system routes
	.listen(port, () => {	//	start the server
		console.log(chalk.bgGreen(`server available on port ${port}`))
	})