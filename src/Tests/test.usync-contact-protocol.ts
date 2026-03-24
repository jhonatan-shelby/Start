import { USyncContactProtocol } from '../WAUSync/Protocols/USyncContactProtocol'
import { USyncUser } from '../WAUSync/USyncUser'

describe('USyncContactProtocol', () => {
  test('getUserElement includes type and username attrs when provided', () => {
    const proto = new USyncContactProtocol()
    const user = new USyncUser().withPhone('+123456789').withType('in').withUsername('the_user')

    const node = proto.getUserElement(user)

    expect(node.tag).toBe('contact')
    expect(node.attrs).toBeDefined()
    expect(node.attrs.type).toBe('in')
    expect(node.attrs.username).toBe('the_user')
    expect(node.content).toBe('+123456789')
  })

  test('parser returns exists and username from node attrs', () => {
    const proto = new USyncContactProtocol()
    const inputNode: any = { tag: 'contact', attrs: { type: 'in', username: 'alice' }, content: '+123' }

    const parsed = proto.parser(inputNode as any)
    expect(parsed).not.toBe(false)
    expect((parsed as any).exists).toBe(true)
    expect((parsed as any).username).toBe('alice')
  })
})
