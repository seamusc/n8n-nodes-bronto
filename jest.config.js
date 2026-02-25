module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testMatch: ['**/nodes/**/*.test.ts', '**/credentials/**/*.test.ts'],
	testPathIgnorePatterns: ['/node_modules/', '/dist/'],
	roots: ['<rootDir>/nodes', '<rootDir>/credentials'],
	moduleNameMapper: {
		'n8n-workflow': '<rootDir>/nodes/__mocks__/n8n-workflow.ts',
	},
};
