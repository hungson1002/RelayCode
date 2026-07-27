export interface ContainerOptions {
  image: string;
  memory: string;
  cpus: number;
  network: boolean;
}

export function buildContainerArgs(root: string, options: ContainerOptions, command: string): string[] {
  return [
    'run', '--rm',
    '--memory', options.memory,
    '--cpus', String(options.cpus),
    '--pids-limit', '256',
    '--security-opt', 'no-new-privileges',
    '--cap-drop', 'ALL',
    '--network', options.network ? 'bridge' : 'none',
    '--mount', `type=bind,source=${root},target=/workspace`,
    '--workdir', '/workspace',
    options.image,
    'sh', '-lc', command
  ];
}
