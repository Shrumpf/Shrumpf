import * as fs from "node:fs";

// Let's see what GPT did here.

const config = {
    templatePath: './build/README.md',
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    USERNAME: process.env.USERNAME,
    BIRTHDAY: process.env.BIRTHDAY
};

function timeSince() {
    const now = new Date();
    const startDate = new Date(config.BIRTHDAY);

    // Calculate differences
    let years = now.getFullYear() - startDate.getFullYear();
    let months = now.getMonth() - startDate.getMonth();
    let days = now.getDate() - startDate.getDate();
    let hours = now.getHours() - startDate.getHours();
    let minutes = now.getMinutes() - startDate.getMinutes();

    // Adjust for negative values in months, days, hours, and minutes
    if (minutes < 0) {
        minutes += 60;
        hours -= 1;
    }
    if (hours < 0) {
        hours += 24;
        days -= 1;
    }
    if (days < 0) {
        // Adjust for previous month’s days
        const previousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        days += previousMonth.getDate();
        months -= 1;
    }
    if (months < 0) {
        months += 12;
        years -= 1;
    }

    return { years, months, days, hours, minutes };
}

async function fetchFunGitHubStats() {
    // GraphQL query for repos, commits, stars, and followers
    const graphqlQuery = `
      query($username: String!, $first: Int!) {
        user(login: $username) {
          repositories(first: $first, isFork: false) {
            totalCount
            nodes {
              name
              stargazerCount
              forkCount
              pushedAt
            }
          }
          followers {
            totalCount
          }
          contributionsCollection {
            contributionCalendar {
              totalContributions
            }
          }
        }
      }
    `;

    const variables = { username: config.USERNAME, first: 100 }; // Fetch up to 100 repositories

    // Call the GraphQL API
    const graphqlResponse = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.GITHUB_TOKEN}`,
        },
        body: JSON.stringify({ query: graphqlQuery, variables }),
    });

    if (!graphqlResponse.ok) {
        throw new Error(`GitHub GraphQL error: ${graphqlResponse.status}`);
    }

    const graphqlData = await graphqlResponse.json();

    if (graphqlData.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(graphqlData.errors)}`);
    }

    const user = graphqlData.data.user;

    // Extract stats
    const repos = user.repositories.totalCount;
    const stars = user.repositories.nodes.reduce((sum, repo) => sum + repo.stargazerCount, 0);
    const mostStarredRepo = user.repositories.nodes.reduce((topRepo, repo) =>
        repo.stargazerCount > (topRepo.stargazerCount || 0) ? repo : topRepo, {})?.name;
    const followers = user.followers.totalCount;
    const commits = user.contributionsCollection.contributionCalendar.totalContributions;

    // REST API call to fetch commits for lines of code changes
    const restApiResponse = await fetch(
        `https://api.github.com/search/commits?q=author:${config.USERNAME}`,
        {
            headers: {
                Accept: 'application/vnd.github.cloak-preview', // Required for commit API
                Authorization: `Bearer ${config.GITHUB_TOKEN}`,
            },
        }
    );

    if (!restApiResponse.ok) {
        throw new Error(`GitHub REST API error: ${restApiResponse.status}`);
    }

    const commitsData = await restApiResponse.json();

    let additions = 0;
    let deletions = 0;

    // Iterate through each commit to get additions and deletions
    for (const commit of commitsData.items) {
        const commitDetailsResponse = await fetch(commit.url, {
            headers: {
                Authorization: `Bearer ${config.GITHUB_TOKEN}`,
            },
        });

        if (!commitDetailsResponse.ok) {
            throw new Error(`GitHub REST API error for commit: ${commitDetailsResponse.status}`);
        }

        const commitDetails = await commitDetailsResponse.json();

        additions += commitDetails.stats.additions;
        deletions += commitDetails.stats.deletions;
    }

    // Calculate funny/creative stats
    const pullRequestsMerged = Math.floor(commits * 0.3); // Mock calculation
    const issuesOpened = Math.floor(commits * 0.1); // Mock calculation
    const mostEditedFile = "README.md"; // Mock data, as this isn’t available via the API
    const busiestHour = "3 PM"; // Placeholder
    const weekendCommits = Math.floor(commits * 0.2); // Mock calculation
    const longestStreak = "42 days"; // Mock data
    const todosAdded = Math.floor(commits * 0.05); // Mock calculation
    const rubberDuckConversations = Math.floor(commits * 0.03); // Mock calculation
    const favoriteEmoji = "🔥"; // Placeholder

    return {
        repos,
        stars,
        mostStarredRepo,
        followers,
        commits,
        additions,
        deletions,
        pullRequestsMerged,
        issuesOpened,
        mostEditedFile,
        busiestHour,
        weekendCommits,
        longestStreak,
        todosAdded,
        rubberDuckConversations,
        favoriteEmoji,
    };
}

async function getData() {
    const { years, months, days, hours, minutes } = timeSince();
    const { repos, stars, followers, commits, additions, deletions } = await fetchFunGitHubStats();

    return {
        years,
        months,
        days,
        hours,
        minutes,
        repos,
        commits,
        stars,
        followers,
        loc: additions + deletions,
        additions,
        deletions
    }
}

// Fill the template with values from the API data
function fillTemplate(template, data) {
    return template
        .replace('{yy}', data.years)
        .replace('{mm}', data.months)
        .replace('{dd}', data.days)
        .replace('{hh}', data.hours)
        .replace('{mm}', data.minutes)
        .replace('{repos}', data.repos)
        .replace('{commits}', data.commits)
        .replace('{stars}', data.stars)
        .replace('{follower}', data.followers)
        .replace('{loc}', data.loc)
        .replace('{additions}', data.additions)
        .replace('{deletions}', data.deletions);
}

// Main function
async function updateTemplate() {
    try {
        // Read the template
        const template = fs.readFileSync(config.templatePath, 'utf-8');

        // Get data from the API
        const data = await getData();

        // Fill the template
        const filledTemplate = fillTemplate(template, data);

        // Write the updated file
        fs.writeFileSync('./README.md', filledTemplate, 'utf-8');

        console.log('Template updated successfully');
    } catch (error) {
        console.error('Error updating template:', error);
    }
}

updateTemplate();