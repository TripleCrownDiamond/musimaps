#!/usr/bin/env node
/**
 * Post-build: copies apps/web/dist → dist/ (root) for Hostinger deployment.
 * Hostinger expects the output directory at the repo root.
 */
import { cpSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const src = join('apps', 'web', 'dist')
const dst = 'dist'

rmSync(dst, { recursive: true, force: true })
cpSync(src, dst, { recursive: true })
console.log(`✓ Copied ${src} → ${dst}`)
