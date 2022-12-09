const fs = require('fs')
const path = require('path')
const YAML = require('yaml')
const core = require('@actions/core');
const github = require('@actions/github')
const crontab = require('cron-parser')
const process = require('process');

const getAllFiles = function (dirPath: string, arrayOfFiles: string[]) {
    const files = fs.readdirSync(dirPath)

    arrayOfFiles = arrayOfFiles || []

    files.forEach(function (file: string) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file))
        }
    })

    return arrayOfFiles
}



export default async () => {
    console.log("Getting reminders")
    const reminders = getAllFiles(".github/reminders", [])

    console.log("Connecting")
    const octokit = github.getOctokit(process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN : '')

    console.log("Getting issues")

    const owner = process.env.GITHUB_REPOSITORY!.split('/')[0];
    const repo = process.env.GITHUB_REPOSITORY!.split('/')[1];

    const issues = Object.values((await octokit.rest.issues.listForRepo({
        owner: owner,
        repo: repo,
        state: 'all'
    })).data)

    reminders.forEach((file_path) => {
        const file = fs.readFileSync(file_path, 'utf8')
        const config = YAML.parse(file)
        console.log("Iterating reminders")
        Object.entries(config).forEach(async (entry) => {
            // reminder config
            const [id, reminder] = entry as [string, any];
            const lineNr = file.split('\n').map((val: string) => val.trim()).indexOf(id + ":") + 1
            console.log("Checking if reminder exists")
            const relPath = path.relative('.', file_path).replaceAll('\\', '/')
            const tasks = reminder.tasks.map((task: string) => "- [ ] " + task + "\n").join("")
            const filename = path.relative('.github/reminders', file_path).replaceAll('\\', '/')
            const footer = "<sub><h6>This reminder was generated from `" + id + "` in <a href=\"https://github.com/" + owner + "/" + repo + "/blob/main/" + relPath + "#L" + lineNr + "\">" + filename + "</a></h6></sub>"
            const issue: any = issues.find((val: any) => val.body?.includes(footer))


            reminder.body += tasks + "___\n"
            reminder.body += footer
            if (issue) {
                console.log("Reminder exists, processing")
                const liveTasks = issue.body?.replace(footer, "").replace(reminder.body, "").replace("___\n", "").split('\n').filter((val: string) => val !== "")

                reminder.assignees = [...new Set([...issue.assignees ? issue.assignees.map((val: any) => val.login) : [], ...reminder.assignees])]

                if (liveTasks?.map((val: string) => val.startsWith('- [x]')).every((val: boolean) => val === true)) {
                    console.log('All tasks solved, closing the issue')
                    await octokit.rest.issues.update({
                        owner: owner,
                        repo: repo,
                        issue_number: issue.number,
                        state: 'closed'
                    })
                }

                // Does it need to be updated? 
                const schedule = crontab.parseExpression(reminder.schedule).prev()
                const last_update = new Date(issue.closed_at ? issue.closed_at : issue.created_at)

                if (new Date(schedule.toString()) > last_update && issue.state === 'closed') {
                    console.log("Reopening reminder as part of schedule")
                    octokit.rest.issues.update({
                        owner: owner,
                        repo: repo,
                        issue_number: issue.number,
                        state: 'open',
                        title: reminder.title,
                        body: reminder.body,
                        labels: reminder.labels,
                        assignees: reminder.assignees
                    })
                }
            } else {
                // Not found, create it
                console.log('Reminder not found, creating: ', reminder.title)
                await octokit.rest.issues.create({
                    owner: owner,
                    repo: repo,
                    title: reminder.title,
                    body: reminder.body,
                    labels: reminder.labels,
                    assignees: reminder.assignees
                })

            }
        })
    })
}
