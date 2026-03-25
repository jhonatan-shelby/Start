import { Boom } from '@hapi/boom'
import { SocketConfig } from '../Types'
import { BinaryNode, S_WHATSAPP_NET } from '../WABinary'
import { USyncQuery } from '../WAUSync'
import { makeSocket } from './socket'

export const makeUSyncSocket = (config: SocketConfig) => {
	const sock = makeSocket(config)

	const {
		generateMessageTag,
		query,
	} = sock

	const executeUSyncQuery = async(usyncQuery: USyncQuery) => {
		if(usyncQuery.protocols.length === 0) {
			throw new Boom('USyncQuery must have at least one protocol')
		}

		// todo: validate users, throw WARNING on no valid users
		// variable below has only validated users
		const validUsers = usyncQuery.users

		const userNodes = validUsers.map((user) => {
			return {
				tag: 'user',
				attrs: {
					jid: !user.phone ? user.id : undefined,
				},
				content: usyncQuery.protocols
					.map((a) => a.getUserElement(user))
					.filter(a => a !== null)
			} as BinaryNode
		})

		const listNode: BinaryNode = {
			tag: 'list',
			attrs: {},
			content: userNodes
		}

		const queryNode: BinaryNode = {
			tag: 'query',
			attrs: {},
			content: usyncQuery.protocols.map((a) => a.getQueryElement())
		}
		const iq = {
			tag: 'iq',
			attrs: {
				to: S_WHATSAPP_NET,
				type: 'get',
				xmlns: 'usync',
			},
			content: [
				{
					tag: 'usync',
					attrs: {
						context: usyncQuery.context,
						mode: usyncQuery.mode,
						sid: generateMessageTag(),
						last: 'true',
						index: '0',
					},
					content: [
						queryNode,
						listNode
					]
				}
			],
		}

		// implement retry + exponential backoff for transient usync errors
		const maxRetries = 3
		const baseDelayMs = 500

		for(let attempt = 0; attempt <= maxRetries; attempt++) {
			const result = await query(iq)
			const parsed = usyncQuery.parseUSyncQueryResult(result)
			// if no error, return immediately
			if(parsed && !parsed.error) return parsed

			// if this was the last attempt, throw a Boom error
			if(attempt === maxRetries) {
				const errMsg = parsed?.error?.message || 'USync query failed after retries'
				throw new Boom(errMsg)
			}

			// determine delay: prefer server-provided retryAfterMs
			const retryAfter = parsed?.error?.retryAfterMs
			const jitter = Math.floor(Math.random() * 100)
			const delay = retryAfter ?? (baseDelayMs * Math.pow(2, attempt) + jitter)
			await new Promise(res => setTimeout(res, delay))
		}
	}

	return {
		...sock,
		executeUSyncQuery,
	}
}