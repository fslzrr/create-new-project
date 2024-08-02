const { execSync } = require('node:child_process');
const path = require('node:path');
const semver = require('semver');

function log(...args) {
	console.log('publisherr: ', ...args);
}

/**
 * logs and executes command
 * @param {string} command
 */
function exec(command) {
	log('running', `'${command}'`);
	return execSync(command);
}

/**
 * gets pull request relevant branches
 * @returns {{
 *  defaultBranch: string;
 *  baseBranch: string;
 *  currentBranch: string;
 * }}
 */
function getBranches() {
	const {
		GITHUB_DEFAULT_BRANCH = 'default-branch', // provided in pipeline
		GITHUB_BASE_REF = 'base-branch',
		GITHUB_HEAD_REF = 'current-branch',
	} = process.env;

	return {
		defaultBranch: GITHUB_DEFAULT_BRANCH,
		baseBranch: GITHUB_BASE_REF,
		currentBranch: GITHUB_HEAD_REF,
	};
}

/**
 * read and parse package.json file
 * @returns {object}
 */
function readPackageJson() {
	const packageJsonString = exec(
		`cat ${path.resolve(process.cwd(), 'package.json')}`,
	).toString();
	const packageJson = JSON.parse(packageJsonString);
	return packageJson;
}

/**
 * formats branch into a valid dist tag
 * @param {string} currentBranch
 * @returns {string}
 */
function getBranchTag(currentBranch) {
	return currentBranch
		.toLowerCase()
		.replace(/[^a-zA-Z\d:]/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * get registry dist-tag current version
 * @param {string} packageName
 * @param {string} tag
 * @returns {string}
 */
function getPackageCurrentVersion(packageName, tag) {
	try {
		const packageViewString = exec(
			`pnpm view ${packageName} dist-tags --json`,
		).toString();
		const distTags = JSON.parse(packageViewString);

		if (distTags[tag]) {
			return distTags[tag];
		}

		if (distTags.latest) {
			log(`dist-tag '${tag}' was not found`);
			log(`defaulting to 'latest' version`);
			return distTags.latest;
		}

		log(`dist-tag 'latests' was not found`);
		log(`current version defaulting to version '0.0.0'`);
		return '0.0.0';
	} catch (_) {
		log('package was not found in registry');
		log(`current version defaulting to version '0.0.0'`);
		return '0.0.0';
	}
}

/**
 * gets package current version by dist tag
 * @param {string} tag
 * @returns {string}
 */
function getCurrentVersion(tag) {
	const packageJson = readPackageJson();
	const currentVersion = getPackageCurrentVersion(packageJson.name, tag);
	return currentVersion;
}

/**
 * updates package.json version
 * @param {string} version
 */
function bumpPackageVersionUp(version) {
	exec(`pnpm version ${version} --no-git-tag-version`);
}

/**
 * publishes package to registry
 * @param {string} tag
 */
function publishToRegistry(tag) {
	exec(`pnpm publish --tag ${tag} --no-git-checks --access=public`);
}

/**
 * publish alpha version
 * @param {string} currentBranch
 */
function publishAlpha(currentBranch) {
	const branchTag = getBranchTag(currentBranch);
	const currentVersion = getCurrentVersion(branchTag);
	const nextAlphaVersion = semver.inc(currentVersion, 'prerelease', branchTag);
	bumpPackageVersionUp(nextAlphaVersion);
	publishToRegistry(branchTag);
}

function publish() {
	const { defaultBranch, baseBranch, currentBranch } = getBranches();

	if (currentBranch === defaultBranch) {
		console.log('latest release not implemented yet');
		return;
	}

	// TODO: publish beta

	if (baseBranch === defaultBranch) {
		publishAlpha(currentBranch);
	}

	// console.log('\n\n');
	// console.log('process.env\n');
	// console.log(JSON.stringify(process.env, null, 4));
}

// just handling alpha versions
publish();
