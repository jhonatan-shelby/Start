import { USyncQueryProtocol } from '../Types/USync'
import { BinaryNode, getBinaryNodeChild } from '../WABinary'
import { USyncBotProfileProtocol } from './Protocols/UsyncBotProfileProtocol'
import { USyncLIDProtocol } from './Protocols/UsyncLIDProtocol'
import { USyncContactProtocol, USyncDeviceProtocol, USyncDisappearingModeProtocol, USyncStatusProtocol } from './Protocols'
import { USyncUser } from './USyncUser'

export type USyncQueryResultList = { [protocol: string]: unknown, id: string }

export type USyncQueryError = {
	code?: string
	message?: string
	retryAfterMs?: number
}

export type USyncQueryResult = {
	list: USyncQueryResultList[]
	sideList: USyncQueryResultList[]
	error?: USyncQueryError
}

export class USyncQuery {
	protocols: USyncQueryProtocol[]
	users: USyncUser[]
	context: string
	mode: string

	constructor() {
		this.protocols = []
		this.users = []
		this.context = 'interactive'
		this.mode = 'query'
	}

	withMode(mode: string) {
		this.mode = mode
		return this
	}

	withContext(context: string) {
		this.context = context
		return this
	}

	withUser(user: USyncUser) {
		this.users.push(user)
		return this
	}

	parseUSyncQueryResult(result: BinaryNode): USyncQueryResult | undefined {
		if(result.attrs.type !== 'result') {
			return
		}

		const protocolMap = Object.fromEntries(this.protocols.map((protocol) => {
			return [protocol.name, protocol.parser]
		}))

		const queryResult: USyncQueryResult = {
			list: [],
			sideList: [],
		}

		const usyncNode = getBinaryNodeChild(result, 'usync')

		// detect errors inside the usync response
		const errorNode = getBinaryNodeChild(usyncNode, 'error')
		if(errorNode) {
			// try to extract useful info from attrs or content
			const code = errorNode.attrs?.code
			let message: string | undefined
			if(Array.isArray(errorNode.content)) {
				const textChild = errorNode.content.find((c: any) => c.tag === 'message' || c.tag === 'text')
				if(textChild && (typeof textChild.content === 'string' || Buffer.isBuffer(textChild.content))) {
					message = typeof textChild.content === 'string' ? textChild.content : textChild.content.toString()
				}
			}
			// parse optional retry-after header if provided
			const retryAfterMs = errorNode.attrs?.['retry-after-ms'] ? +errorNode.attrs['retry-after-ms'] : undefined
			queryResult.error = { code, message, retryAfterMs }
			return queryResult
		}

		const listNode = getBinaryNodeChild(usyncNode, 'list')
		if(Array.isArray(listNode?.content) && typeof listNode !== 'undefined') {
			queryResult.list = listNode.content.map((node) => {
				const id = node?.attrs.jid
				const data = Array.isArray(node?.content) ? Object.fromEntries(node.content.map((content) => {
					const protocol = content.tag
					const parser = protocolMap[protocol]
					if(parser) {
						return [protocol, parser(content)]
					} else {
						return [protocol, null]
					}
				}).filter(([, b]) => b !== null) as [string, unknown][]) : {}
				return { ...data, id }
			})
		}

		//TODO: implement side list
		//const sideListNode = getBinaryNodeChild(usyncNode, 'side_list')
		return queryResult
	}

	withDeviceProtocol() {
		this.protocols.push(new USyncDeviceProtocol())
		return this
	}

	withContactProtocol() {
		this.protocols.push(new USyncContactProtocol())
		return this
	}

	withStatusProtocol() {
		this.protocols.push(new USyncStatusProtocol())
		return this
	}

	withDisappearingModeProtocol() {
		this.protocols.push(new USyncDisappearingModeProtocol())
		return this
	}

	withBotProfileProtocol() {
		this.protocols.push(new USyncBotProfileProtocol())
		return this
	}

	withLIDProtocol() {
		this.protocols.push(new USyncLIDProtocol())
		return this
	}
}
