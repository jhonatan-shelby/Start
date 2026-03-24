import { USyncQueryProtocol } from '../../Types/USync'
import { assertNodeErrorFree, BinaryNode } from '../../WABinary'
import { USyncUser } from '../USyncUser'

export class USyncContactProtocol implements USyncQueryProtocol {
	name = 'contact'

	getQueryElement(): BinaryNode {
		return {
			tag: 'contact',
			attrs: {},
		}
	}

	getUserElement(user: USyncUser): BinaryNode {
		// Include optional type and username attrs when provided by the caller
		const attrs: { [k: string]: string } = {}
		if(user.type) attrs.type = user.type
		if((user as any).username) attrs.username = (user as any).username

		return {
			tag: 'contact',
			attrs,
			content: user.phone,
		}
	}

	parser(node: BinaryNode): { exists: boolean, username?: string } | false {
		if(node.tag === 'contact') {
			assertNodeErrorFree(node)
			const exists = node?.attrs?.type === 'in'
			const username = node?.attrs?.username
			return { exists, username }
		}

		return false
	}
}