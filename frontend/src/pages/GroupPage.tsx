import React, { useState, useEffect } from "react";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../components/ui/Table";
import { Trash2, Activity, Package, CreditCard } from "lucide-react";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";

interface Group {
  id: string;
  name: string;
  quantity: number;
  subBrokers: string[];
}

const GroupPage: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupQuantity, setNewGroupQuantity] = useState(1);
  const [availableBrokers, setAvailableBrokers] = useState<string[]>([]);
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);

  useEffect(() => {
    // TODO: Load available brokers (subbrokers) from API
    setAvailableBrokers(["Broker 1", "Broker 2", "Broker 3"]);
  }, []);

  const handleCreateGroup = () => {
    const newGroup: Group = {
      id: Date.now().toString(),
      name: newGroupName,
      quantity: newGroupQuantity,
      subBrokers: selectedBrokers,
    };
    setGroups([...groups, newGroup]);
    setIsCreateModalOpen(false);
    setNewGroupName("");
    setNewGroupQuantity(1);
    setSelectedBrokers([]);
  };

  const handleUpdateQuantity = (groupId: string, newQuantity: number) => {
    setGroups(
      groups.map((group) =>
        group.id === groupId ? { ...group, quantity: newQuantity } : group
      )
    );
    if (selectedGroup?.id === groupId) {
      setSelectedGroup({ ...selectedGroup, quantity: newQuantity });
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Header />
        <main className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Groups</h1>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Create Group
            </Button>
          </div>

          {/* Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => setSelectedGroup(group)}
              >
                <CardHeader>{group.name}</CardHeader>
                <CardContent>
                  <div className="flex justify-between">
                    <span>Quantity: {group.quantity}</span>
                    <span>Brokers: {group.subBrokers.length}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Group Details */}
          {selectedGroup && (
            <Card>
              <CardHeader className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">{selectedGroup.name}</h2>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={selectedGroup.quantity}
                    onChange={(e) =>
                      handleUpdateQuantity(
                        selectedGroup.id,
                        parseInt(e.target.value)
                      )
                    }
                    className="w-20"
                  />
                  <Button variant="primary">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sub Brokers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGroup.subBrokers.map((broker) => (
                      <TableRow key={broker}>
                        <TableCell>{broker}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Create Group Modal */}
          <Modal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Create New Group"
          >
            <div className="space-y-4">
              <Input
                label="Group Name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name"
                required
              />
              <Input
                type="number"
                label="Quantity"
                value={newGroupQuantity}
                onChange={(e) => setNewGroupQuantity(parseInt(e.target.value))}
                min="1"
                required
              />
              <div>
                <label className="block mb-2 text-sm font-medium">
                  Select Sub Brokers
                </label>
                <div className="border rounded-lg p-2 max-h-40 overflow-auto">
                  {availableBrokers.map((broker) => (
                    <div key={broker} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id={broker}
                        checked={selectedBrokers.includes(broker)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBrokers([...selectedBrokers, broker]);
                          } else {
                            setSelectedBrokers(
                              selectedBrokers.filter((b) => b !== broker)
                            );
                          }
                        }}
                        className="mr-2"
                      />
                      <label htmlFor={broker}>{broker}</label>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                onClick={handleCreateGroup}
                disabled={!newGroupName || selectedBrokers.length === 0}
                className="w-full"
              >
                Create Group
              </Button>
            </div>
          </Modal>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default GroupPage;