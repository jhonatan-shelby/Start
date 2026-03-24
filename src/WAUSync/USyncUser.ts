export class USyncUser {
	id: string
	lid: string
	phone: string
	type: string
	username?: string
	personaId: string

	withId(id: string) {
		this.id = id
		return this
	}

	withLid(lid: string) {
		this.lid = lid
		return this
	}

	withPhone(phone: string) {
		this.phone = phone
		return this
	}

	withType(type: string) {
		this.type = type
		return this
	}

	withPersonaId(personaId: string) {
	  this.personaId = personaId
	  return this
	}

		withUsername(username: string) {
			this.username = username
			return this
		}
}
