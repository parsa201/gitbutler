import type { PullRequest } from '$lib/github/types';
import type { RemoteBranch } from '$lib/vbranches/types';
import { CombinedBranch } from '$lib/remotecontributions/types';
import { Observable, combineLatest } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import type { RemoteBranchService } from '$lib/stores/remoteBranches';
import type { PrService } from '$lib/github/pullrequest';
import { plainToInstance } from 'class-transformer';

export class BranchService {
	public branches$: Observable<CombinedBranch[]>;

	constructor(remoteBranchService: RemoteBranchService, prService: PrService) {
		this.branches$ = combineLatest([remoteBranchService.branches$, prService.prs$]).pipe(
			switchMap(
				([remoteBranches, pullRequests]) =>
					new Observable<CombinedBranch[]>((observer) => {
						const contributions = mergeBranchesAndPrs(pullRequests, remoteBranches || []);
						observer.next(contributions);
					})
			)
		);
	}
}

function mergeBranchesAndPrs(
	pullRequests: PullRequest[],
	remoteBranches: RemoteBranch[]
): CombinedBranch[] {
	const contributions: CombinedBranch[] = [];
	// branches without pull requests
	contributions.push(
		...remoteBranches
			.filter((b) => !pullRequests.some((pr) => brachesMatch(pr.targetBranch, b.name)))
			.map((remoteBranch) => new CombinedBranch({ remoteBranch }))
	);
	// pull requests without branches
	contributions.push(
		...pullRequests
			.filter((pr) => !remoteBranches.some((branch) => brachesMatch(pr.targetBranch, branch.name)))
			.map((pr) => new CombinedBranch({ pr }))
	);
	// branches with pull requests
	contributions.push(
		...remoteBranches
			.filter((branch) => pullRequests.some((pr) => brachesMatch(pr.targetBranch, branch.name)))
			.map((remoteBranch) => {
				const pr = pullRequests.find((pr) => brachesMatch(pr.targetBranch, remoteBranch.name));
				return new CombinedBranch({ pr, remoteBranch });
			})
	);
	return contributions.sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
}

function brachesMatch(left: string, right: string): boolean {
	return left.split('/').pop() === right.split('/').pop();
}
