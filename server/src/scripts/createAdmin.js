import { emitKeypressEvents } from 'node:readline'
import { createInterface } from 'node:readline/promises'
import mongoose from 'mongoose'
import { connectDatabase } from '../config/database.js'
import { User } from '../models/index.js'

function promptSecret(input, output, label) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Run this command from an interactive terminal.')
  }

  emitKeypressEvents(input)
  input.setRawMode(true)
  input.resume()
  output.write(`${label}: `)

  return new Promise((resolve, reject) => {
    let value = ''
    const cleanup = () => {
      input.off('keypress', onKeypress)
      input.setRawMode(false)
      input.pause()
      output.write('\n')
    }

    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup()
        reject(new Error('Admin setup cancelled.'))
        return
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup()
        resolve(value)
        return
      }
      if (key.name === 'backspace') {
        if (value.length) {
          value = value.slice(0, -1)
          output.write('\b \b')
        }
        return
      }
      if (character && !key.ctrl && !key.meta) {
        value += character
        output.write('*')
      }
    }

    input.on('keypress', onKeypress)
  })
}

async function createInitialAdmin({ name, email, password }) {
  if (await User.exists({ role: 'admin' })) {
    throw new Error('An admin account already exists. Sign in with that account instead.')
  }
  if (await User.exists({ email })) {
    throw new Error('An account with that email already exists. Choose a different email.')
  }

  await new User({ name, email, password, role: 'admin' }).save()
}

async function main() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  const name = (await prompt.question('Admin name: ')).trim()
  const email = (await prompt.question('Admin email: ')).trim().toLowerCase()
  prompt.close()

  const password = await promptSecret(process.stdin, process.stdout, 'Admin password (hidden)')
  if (!name || name.length > 120) throw new Error('Name must be between 1 and 120 characters.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('Enter a valid email address.')
  }
  if (password.length < 8 || password.length > 128) {
    throw new Error('Password must be between 8 and 128 characters.')
  }

  await connectDatabase()
  await createInitialAdmin({ name, email, password })
  console.log(`Admin account created for ${email}. Sign in at the normal login page.`)
}

main()
  .catch((error) => {
    console.error('Admin setup failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
