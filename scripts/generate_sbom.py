#!/usr/bin/env python3
"""
SBOM Generator for OpenReg

Generates Software Bill of Materials (SBOM) in CycloneDX format for:
- Python backend dependencies
- JavaScript frontend dependencies

Usage:
    python scripts/generate_sbom.py [--output-dir DIR]

Output:
    - sbom-backend.json: Python dependencies SBOM
    - sbom-frontend.json: JavaScript dependencies SBOM
    - licenses-backend.json: Python license report
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime, timezone


def run_command(cmd: list[str], cwd: Path = None) -> tuple[bool, str, str]:
    """Run a command and return (success, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=True
        )
        return True, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return False, e.stdout, e.stderr
    except FileNotFoundError:
        return False, "", f"Command not found: {cmd[0]}"


def generate_python_sbom(output_dir: Path, backend_dir: Path) -> bool:
    """Generate SBOM for Python dependencies using cyclonedx-bom."""
    print("Generating Python SBOM...")

    requirements_file = backend_dir / "requirements.txt"
    if not requirements_file.exists():
        print(f"  ERROR: {requirements_file} not found")
        return False

    output_file = output_dir / "sbom-backend.json"

    # Use cyclonedx-py to generate SBOM from requirements
    success, stdout, stderr = run_command([
        sys.executable, "-m", "cyclonedx_py",
        "requirements",
        str(requirements_file),
        "--of", "JSON",
        "-o", str(output_file)
    ])

    if success:
        print(f"  Generated: {output_file}")
        return True
    else:
        print(f"  ERROR: {stderr}")
        return False


def generate_python_license_report(output_dir: Path, backend_dir: Path) -> bool:
    """Generate license report for Python dependencies using pip-licenses."""
    print("Generating Python license report...")

    # Use absolute path for output file since pip-licenses runs in different cwd
    output_file = output_dir.absolute() / "licenses-backend.json"

    # pip-licenses is a command-line tool that reports on installed packages
    # No cwd needed - it reports the current Python environment
    success, stdout, stderr = run_command([
        "pip-licenses",
        "--format", "json",
        "--with-urls",
        "--output-file", str(output_file)
    ])

    if success:
        print(f"  Generated: {output_file}")
        return True
    else:
        print(f"  WARNING: Could not generate license report: {stderr}")
        return False


def verify_python_licenses(backend_dir: Path) -> bool:
    """Verify Python licenses against policy using liccheck."""
    print("Verifying Python licenses against policy...")

    liccheck_ini = backend_dir / "liccheck.ini"
    requirements_file = backend_dir / "requirements.txt"

    if not liccheck_ini.exists():
        print(f"  WARNING: {liccheck_ini} not found, skipping license verification")
        return True

    success, stdout, stderr = run_command([
        sys.executable, "-m", "liccheck",
        "-s", str(liccheck_ini),
        "-r", str(requirements_file)
    ])

    if success:
        print("  License verification PASSED")
        return True
    else:
        print(f"  License verification FAILED:\n{stderr}")
        return False


def generate_frontend_sbom(output_dir: Path, frontend_dir: Path) -> bool:
    """Generate SBOM for JavaScript dependencies using npm sbom."""
    print("Generating Frontend SBOM...")

    package_json = frontend_dir / "package.json"
    if not package_json.exists():
        print(f"  ERROR: {package_json} not found")
        return False

    output_file = output_dir / "sbom-frontend.json"

    # Check npm version (sbom requires npm 9+)
    success, version_output, _ = run_command(["npm", "--version"])
    if success:
        npm_version = int(version_output.strip().split(".")[0])
        if npm_version < 9:
            print(f"  WARNING: npm {version_output.strip()} detected, sbom requires npm 9+")
            print("  Falling back to package-lock.json parsing...")
            return generate_frontend_sbom_fallback(output_dir, frontend_dir)

    # Use npm sbom (npm 9+)
    success, stdout, stderr = run_command([
        "npm", "sbom",
        "--sbom-format=cyclonedx",
        "--omit=dev"
    ], cwd=frontend_dir)

    if success:
        # Write output to file
        with open(output_file, "w") as f:
            f.write(stdout)
        print(f"  Generated: {output_file}")
        return True
    else:
        print(f"  WARNING: npm sbom failed, trying fallback: {stderr}")
        return generate_frontend_sbom_fallback(output_dir, frontend_dir)


def generate_frontend_sbom_fallback(output_dir: Path, frontend_dir: Path) -> bool:
    """Fallback SBOM generation by parsing package.json."""
    print("  Using fallback SBOM generation...")

    package_json = frontend_dir / "package.json"
    output_file = output_dir / "sbom-frontend.json"

    try:
        with open(package_json) as f:
            pkg = json.load(f)

        # Create minimal CycloneDX SBOM
        sbom = {
            "bomFormat": "CycloneDX",
            "specVersion": "1.4",
            "version": 1,
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "component": {
                    "type": "application",
                    "name": pkg.get("name", "openreg-frontend"),
                    "version": pkg.get("version", "0.0.0")
                }
            },
            "components": []
        }

        # Add production dependencies
        for name, version in pkg.get("dependencies", {}).items():
            sbom["components"].append({
                "type": "library",
                "name": name,
                "version": version.lstrip("^~>=<"),
                "purl": f"pkg:npm/{name}@{version.lstrip('^~>=<')}"
            })

        with open(output_file, "w") as f:
            json.dump(sbom, f, indent=2)

        print(f"  Generated (fallback): {output_file}")
        return True
    except Exception as e:
        print(f"  ERROR: Fallback SBOM generation failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate SBOMs for OpenReg")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("sbom"),
        help="Output directory for SBOM files (default: ./sbom)"
    )
    parser.add_argument(
        "--verify-licenses",
        action="store_true",
        help="Also verify licenses against policy"
    )
    args = parser.parse_args()

    # Determine paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    backend_dir = project_root / "backend"
    frontend_dir = project_root / "frontend"
    output_dir = args.output_dir

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"OpenReg SBOM Generator")
    print(f"======================")
    print(f"Output directory: {output_dir.absolute()}")
    print()

    results = []

    # Generate Python SBOM
    results.append(("Python SBOM", generate_python_sbom(output_dir, backend_dir)))

    # Generate Python license report
    results.append(("Python Licenses", generate_python_license_report(output_dir, backend_dir)))

    # Optionally verify licenses
    if args.verify_licenses:
        results.append(("License Policy", verify_python_licenses(backend_dir)))

    # Generate Frontend SBOM
    results.append(("Frontend SBOM", generate_frontend_sbom(output_dir, frontend_dir)))

    print()
    print("Summary")
    print("-------")
    all_passed = True
    for name, success in results:
        status = "PASS" if success else "FAIL"
        print(f"  {name}: {status}")
        if not success:
            all_passed = False

    # Write manifest
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "files": [f.name for f in output_dir.glob("*.json")],
        "all_passed": all_passed
    }
    with open(output_dir / "manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
