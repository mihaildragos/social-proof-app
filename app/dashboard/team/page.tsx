import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  Plus,
  Search,
  Settings,
  Mail,
  MoreHorizontal,
  Shield,
  UserCheck,
  UserX,
  Crown,
  Eye,
  Edit,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Team | Social Proof Dashboard",
  description: "Manage your team members, roles, and permissions",
};

// Mock data - in real app this would come from API
const mockTeamMembers = [
  {
    id: 1,
    name: "John Smith",
    email: "john@example.com",
    role: "Admin",
    status: "active",
    avatar: "/avatars/john.jpg",
    joinedAt: "2024-01-15",
    lastActive: "2 minutes ago",
    permissions: ["all"],
  },
  {
    id: 2,
    name: "Sarah Johnson",
    email: "sarah@example.com",
    role: "Analyst",
    status: "active",
    avatar: "/avatars/sarah.jpg",
    joinedAt: "2024-01-12",
    lastActive: "1 hour ago",
    permissions: ["analytics", "notifications"],
  },
  {
    id: 3,
    name: "Mike Chen",
    email: "mike@example.com",
    role: "Designer",
    status: "active",
    avatar: "/avatars/mike.jpg",
    joinedAt: "2024-01-10",
    lastActive: "3 hours ago",
    permissions: ["notifications", "templates"],
  },
  {
    id: 4,
    name: "Emily Davis",
    email: "emily@example.com",
    role: "Analyst",
    status: "pending",
    avatar: "/avatars/emily.jpg",
    joinedAt: "2024-01-08",
    lastActive: "Never",
    permissions: ["analytics"],
  },
];

const mockInvitations = [
  {
    id: 1,
    email: "alex@example.com",
    role: "Designer",
    invitedBy: "John Smith",
    invitedAt: "2024-01-20",
    status: "pending",
    expiresAt: "2024-01-27",
  },
  {
    id: 2,
    email: "lisa@example.com",
    role: "Analyst",
    invitedBy: "John Smith",
    invitedAt: "2024-01-19",
    status: "pending",
    expiresAt: "2024-01-26",
  },
];

const rolePermissions = {
  Admin: {
    description: "Full access to all features and settings",
    permissions: ["All permissions", "User management", "Billing access", "Site management"],
    color: "bg-red-100 text-red-800",
  },
  Analyst: {
    description: "Access to analytics and reporting features",
    permissions: ["View analytics", "Export reports", "View notifications"],
    color: "bg-blue-100 text-blue-800",
  },
  Designer: {
    description: "Access to notification design and templates",
    permissions: ["Create notifications", "Edit templates", "Preview notifications"],
    color: "bg-green-100 text-green-800",
  },
};

function TeamMemberCard({ member }: { member: (typeof mockTeamMembers)[0] }) {
  const roleInfo = rolePermissions[member.role as keyof typeof rolePermissions];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarImage
                src={member.avatar}
                alt={member.name}
              />
              <AvatarFallback>
                {member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{member.name}</CardTitle>
              <CardDescription className="flex items-center space-x-2">
                <Mail className="h-3 w-3" />
                <span>{member.email}</span>
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={member.status === "active" ? "default" : "secondary"}>
              {member.status}
            </Badge>
            <Button size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {member.role === "Admin" && <Crown className="h-4 w-4 text-yellow-500" />}
              {member.role === "Analyst" && <Eye className="h-4 w-4 text-blue-500" />}
              {member.role === "Designer" && <Edit className="h-4 w-4 text-green-500" />}
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${roleInfo.color}`}>
                {member.role}
              </span>
            </div>
            <span className="text-sm text-gray-500">Last active: {member.lastActive}</span>
          </div>

          <div>
            <p className="mb-2 text-sm text-gray-600">{roleInfo.description}</p>
            <div className="flex flex-wrap gap-1">
              {roleInfo.permissions.slice(0, 3).map((permission, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs"
                >
                  {permission}
                </Badge>
              ))}
              {roleInfo.permissions.length > 3 && (
                <Badge
                  variant="secondary"
                  className="text-xs"
                >
                  +{roleInfo.permissions.length - 3} more
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Joined: {new Date(member.joinedAt).toLocaleDateString()}</span>
            <div className="flex space-x-2">
              <Button size="sm">
                <Settings className="mr-1 h-3 w-3" />
                Manage
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InvitationCard({ invitation }: { invitation: (typeof mockInvitations)[0] }) {
  const roleInfo = rolePermissions[invitation.role as keyof typeof rolePermissions];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <Mail className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{invitation.email}</p>
              <p className="text-sm text-gray-500">
                Invited by {invitation.invitedBy} •{" "}
                {new Date(invitation.invitedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${roleInfo.color}`}>
              {invitation.role}
            </span>
            <Badge variant="secondary">Pending</Badge>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
          </span>
          <div className="flex space-x-2">
            <Button size="sm">Resend</Button>
            <Button size="sm">Cancel</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TeamPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-600">Manage your team members, roles, and permissions</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {/* Team Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockTeamMembers.length}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+2</span> this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockTeamMembers.filter((m) => m.status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(
                (mockTeamMembers.filter((m) => m.status === "active").length /
                  mockTeamMembers.length) *
                  100
              )}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockInvitations.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockTeamMembers.filter((m) => m.role === "Admin").length}
            </div>
            <p className="text-xs text-muted-foreground">Full access</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search team members..."
                className="pl-10"
              />
            </div>
            <Button>Filter by Role</Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Team Members</h2>
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          {mockTeamMembers.map((member) => (
            <TeamMemberCard
              key={member.id}
              member={member}
            />
          ))}
        </div>
      </div>

      {/* Pending Invitations */}
      {mockInvitations.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Pending Invitations</h2>
          <div className="space-y-4">
            {mockInvitations.map((invitation) => (
              <InvitationCard
                key={invitation.id}
                invitation={invitation}
              />
            ))}
          </div>
        </div>
      )}

      {/* Role Permissions */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>Overview of what each role can access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {Object.entries(rolePermissions).map(([role, info]) => (
              <div
                key={role}
                className="space-y-3"
              >
                <div className="flex items-center space-x-2">
                  {role === "Admin" && <Crown className="h-5 w-5 text-yellow-500" />}
                  {role === "Analyst" && <Eye className="h-5 w-5 text-blue-500" />}
                  {role === "Designer" && <Edit className="h-5 w-5 text-green-500" />}
                  <h3 className="font-medium text-gray-900">{role}</h3>
                </div>
                <p className="text-sm text-gray-600">{info.description}</p>
                <div className="space-y-1">
                  {info.permissions.map((permission, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 text-sm"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                      <span className="text-gray-600">{permission}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
